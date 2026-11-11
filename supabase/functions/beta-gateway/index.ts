import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
};
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
function checked<
  R extends { data: unknown; error: { message: string } | null },
>(result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<R["data"]>;
}
const uuid = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value))
    throw new Error("Invalid request identifier.");
  return value;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if (Number(req.headers.get("content-length") || 0) > 16000)
    return reply({ error: "Request too large." }, 413);
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const reader = req.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16000) {
          await reader.cancel();
          return reply({ error: "Request too large." }, 413);
        }
        chunks.push(value);
      }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const input = JSON.parse(new TextDecoder().decode(bytes));
    const action = String(input.action || "");
    const maintenance = async () => {
      const jobs = checked(await admin.rpc("maintenance_candidates")) || [];
      for (const job of jobs) {
        checked(
          await admin.storage
            .from("cutouts")
            .remove([job.original_path, job.cutout_path]),
        );
        checked(await admin.rpc("expire_capture", { p_job: job.id }));
      }
      const orphans = checked(await admin.rpc("orphan_media")) || [];
      for (let i = 0; i < orphans.length; i += 100)
        checked(
          await admin.storage.from("cutouts").remove(orphans.slice(i, i + 100)),
        );
      checked(
        await admin
          .from("trades")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("status", "proposed")
          .lt("expires_at", new Date().toISOString()),
      );
      return {
        ok: true,
        expired_captures: jobs.length,
        orphan_photos: orphans.length,
      };
    };
    if (action === "scheduled-maintenance") {
      if (
        !checked(
          await admin.rpc("authorize_maintenance", {
            p_token: req.headers.get("x-maintenance-token") || "",
          }),
        )
      )
        return reply({ error: "Unauthorized maintenance." }, 403);
      return reply(await maintenance());
    }
    if (action === "join" || action === "recover") {
      const { code, email, password } = input;
      if (
        typeof code !== "string" ||
        !/^[a-f0-9]{32}$/i.test(code) ||
        typeof email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      )
        throw new Error(
          "Enter a valid invitation, email and password (at least 12 characters).",
        );
      if (
        action === "join" &&
        (!/^@[a-z0-9._]{3,30}$/.test(input.handle) ||
          !String(input.name || "").trim() ||
          !String(input.city || "").trim())
      )
        throw new Error("Add your handle, name and Philippine city.");
      const claim = checked(
        await admin.rpc("claim_invite", {
          p_code: code,
          p_email: email.toLowerCase().trim(),
        }),
      );
      let created: string | undefined;
      try {
        if ((action === "recover") !== (claim.purpose === "recovery"))
          throw new Error(
            "Use this code in the matching join or recovery screen.",
          );
        if (action === "join") {
          const result = checked(
            await admin.auth.admin.createUser({
              email: email.toLowerCase().trim(),
              password,
              email_confirm: true,
            }),
          );
          created = result.user!.id;
          checked(
            await admin.rpc("finish_invite", {
              p_claim: claim.claim,
              p_user: created,
              p_email: email.toLowerCase().trim(),
              p_profile: {
                handle: input.handle,
                name: input.name,
                city: input.city,
              },
            }),
          );
        } else {
          checked(
            await admin.auth.admin.updateUserById(claim.user_id, { password }),
          );
          const account = checked(
            await admin.auth.admin.getUserById(claim.user_id),
          );
          const recoveryClient = createClient(
            env("SUPABASE_URL"),
            env("SUPABASE_ANON_KEY"),
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const session = checked(
            await recoveryClient.auth.signInWithPassword({
              email: account.user!.email!,
              password,
            }),
          );
          if (session.session)
            checked(
              await admin.auth.admin.signOut(
                session.session.access_token,
                "others",
              ),
            );
          checked(
            await admin.rpc("finish_invite", {
              p_claim: claim.claim,
              p_user: claim.user_id,
              p_email: email,
              p_profile: {},
            }),
          );
        }
        return reply({ ok: true });
      } catch (error) {
        if (created) await admin.auth.admin.deleteUser(created);
        await admin.rpc("release_invite", { p_claim: claim.claim });
        throw error;
      }
    }
    if (action === "worker-authorize") {
      const valid = checked(
        await admin.rpc("worker_authorize", {
          p_job: uuid(input.job_id),
          p_ticket: String(input.ticket || ""),
          p_token: String(input.worker_token || ""),
        }),
      );
      return reply({ ok: valid }, valid ? 200 : 403);
    }
    if (action === "worker-claim") {
      const jobId = uuid(input.job_id);
      const token = String(input.worker_token || "");
      if (
        !checked(
          await admin.rpc("worker_validate_dispatch", {
            p_job: jobId,
            p_ticket: String(input.ticket || ""),
          }),
        )
      )
        return reply({ error: "Invalid worker ticket." }, 403);
      const job = checked(
        await admin.rpc("claim_capture", { p_job: jobId, p_token: token }),
      );
      if (!job?.id) return reply({ skipped: true });
      const download = checked(
        await admin.storage
          .from("cutouts")
          .createSignedUrl(job.original_path, 180),
      );
      const upload = checked(
        await admin.storage
          .from("cutouts")
          .createSignedUploadUrl(job.cutout_path, { upsert: false }),
      );
      return reply({
        job_id: job.id,
        lease_id: job.lease_id,
        download_url: download.signedUrl,
        upload_url: upload.signedUrl,
        upload_token: upload.token,
        cutout_path: job.cutout_path,
      });
    }
    if (action === "worker-complete") {
      const completed = checked(
        await admin.rpc("complete_capture", {
          p_job: uuid(input.job_id),
          p_lease: uuid(input.lease_id),
          p_token: String(input.worker_token || ""),
          p_width: Number(input.width) || 0,
          p_height: Number(input.height) || 0,
          p_error: input.error ? String(input.error).slice(0, 500) : null,
        }),
      );
      return reply({ ok: completed });
    }
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const identity = await admin.auth.getUser(token);
    if (identity.error || !identity.data.user)
      return reply({ error: "Sign in to Fraggy." }, 401);
    const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: auth } },
    });
    if (action === "create-capture") {
      const job = checked(await user.rpc("create_capture"));
      const upload = checked(
        await admin.storage
          .from("cutouts")
          .createSignedUploadUrl(job.original_path, { upsert: false }),
      );
      return reply({ job, upload_url: upload.signedUrl });
    }
    if (action === "resume-upload") {
      const job = checked(
        await user.rpc("resume_capture", { p_job: uuid(input.job_id) }),
      );
      const info = await admin.storage.from("cutouts").info(job.original_path);
      if (!info.error) return reply({ uploaded: true });
      const upload = checked(
        await admin.storage
          .from("cutouts")
          .createSignedUploadUrl(job.original_path, { upsert: false }),
      );
      return reply({ upload_url: upload.signedUrl });
    }
    if (action === "start-capture" || action === "retry-capture") {
      const job = checked(
        await user.rpc(
          action === "retry-capture" ? "retry_capture" : "start_capture",
          {
            p_job: uuid(input.job_id),
            p_draft: input.draft || {},
          },
        ),
      );
      if (job.status === "ready" || job.status === "processing")
        return reply({ job });
      const config = checked(await admin.rpc("worker_dispatch_config"));
      if (!config?.url) {
        await admin
          .from("capture_jobs")
          .update({
            status: "failed",
            error:
              "Hosted photo processing is not configured yet. Your original is saved.",
          })
          .eq("id", job.id);
        return reply(
          {
            error:
              "Hosted photo processing is not configured yet. Your original is saved.",
            job_id: job.id,
          },
          503,
        );
      }
      const ticket = checked(
        await admin.rpc("worker_dispatch_ticket", { p_job: job.id }),
      );
      await admin
        .from("capture_jobs")
        .update({ status: "waking", updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "queued");
      const dispatch = async () => {
        try {
          const response = await fetch(`${config.url}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id, ticket }),
            signal: AbortSignal.timeout(120000),
          });
          if (!response.ok)
            throw new Error(
              "The photo processor is busy. Your photo is saved; retry shortly.",
            );
        } catch (error) {
          await admin
            .from("capture_jobs")
            .update({
              status: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not start the processor.",
            })
            .eq("id", job.id)
            .in("status", ["waking", "queued"]);
        }
      };
      EdgeRuntime.waitUntil(dispatch());
      return reply({ job: { ...job, status: "waking" } }, 202);
    }
    if (action === "condition-upload" || action === "avatar-upload") {
      const path = checked(
        await user.rpc("extra_photo_ticket", {
          p_kind: action === "avatar-upload" ? "avatar" : "condition",
          p_size: Number(input.size),
        }),
      );
      const upload = checked(
        await admin.storage
          .from("cutouts")
          .createSignedUploadUrl(path, { upsert: false }),
      );
      return reply({ path, upload_url: upload.signedUrl });
    }
    if (action === "delete-account") {
      checked(await user.rpc("prepare_account_deletion"));
      checked(await admin.auth.admin.deleteUser(identity.data.user.id));
      return reply({ ok: true });
    }
    if (action === "maintenance") {
      checked(await user.rpc("admin_state"));
      return reply(await maintenance());
    }
    if (action === "export-backup") {
      checked(await user.rpc("admin_state"));
      const tables = [
        "profiles",
        "shelves",
        "bottles",
        "trades",
        "trade_messages",
        "trade_events",
        "notifications",
        "reviews",
        "reports",
        "blocks",
        "capture_jobs",
      ];
      const data: Record<string, unknown> = {
        version: 1,
        created_at: new Date().toISOString(),
      };
      for (const table of tables)
        data[table] = checked(await admin.from(table).select("*"));
      return reply(data);
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "Request failed." },
      400,
    );
  }
});
