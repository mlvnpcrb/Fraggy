import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { AccountScope, signOutDevice } from "./session";
import { processCapture, recoverUploadedCapture } from "./capture";
import { emptyBottle, type Job } from "./types";
describe("account boundaries", () => {
  it("removes persisted and in-memory credentials even when Auth logout returns 503", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const client = createClient("https://test.supabase.co", "test-key", {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input) =>
          new Response(
            JSON.stringify(
              String(input).includes("/logout")
                ? { message: "unavailable" }
                : {
                    id: "user-a",
                    email: "a@example.test",
                    aud: "authenticated",
                    role: "authenticated",
                  },
            ),
            {
              status: String(input).includes("/logout") ? 503 : 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      },
    });
    const jwt = [
      btoa('{"alg":"HS256"}'),
      btoa(
        JSON.stringify({
          sub: "user-a",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
      "c2lnbmF0dXJl",
    ].join(".");
    await client.auth.setSession({
      access_token: jwt,
      refresh_token: "test-refresh",
    });
    expect((await client.auth.getSession()).data.session).not.toBeNull();
    await signOutDevice(client);
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect([...values.keys()].filter((k) => k.endsWith("auth-token"))).toEqual(
      [],
    );
    const restarted = createClient("https://test.supabase.co", "test-key", {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await restarted.auth.getSession()).data.session).toBeNull();
  });
  for (const phase of ["create-capture", "upload", "start-capture"] as const)
    it(`cannot write A's capture into B after switching during ${phase}`, async () => {
      const account = new AccountScope();
      account.set("A");
      const lease = account.capture();
      let resolve!: () => void;
      const wait = new Promise<void>((r) => (resolve = r));
      let began!: () => void;
      const started = new Promise<void>((r) => (began = r));
      const saved: { owner: string; jobId?: string }[] = [];
      let startCalls = 0;
      const gateway = async <T>(action: string) => {
        if (action === "start-capture") startCalls++;
        if (action === phase) {
          began();
          await wait;
        }
        return (
          action === "create-capture"
            ? { job: { id: "job-a" }, upload_url: "signed-a" }
            : {}
        ) as T;
      };
      const promise = processCapture(
        {
          id: "draft-a",
          uri: "private-a",
          form: emptyBottle,
          createdAt: "now",
        },
        {
          gateway,
          save: async (d) => {
            saved.push({
              owner: account.valid(lease) ? "A" : "B",
              jobId: d.jobId,
            });
          },
          upload: async () => {
            if (phase === "upload") {
              began();
              await wait;
            }
          },
          loadJobs: async () => [],
          latestForm: () => emptyBottle,
          refresh: async () => {},
          isCurrent: () => account.valid(lease),
        },
      ).catch(() => {});
      await started;
      account.invalidate();
      account.set("B");
      saved.length = 0;
      resolve();
      await promise;
      expect(saved).toEqual([]);
      if (phase !== "start-capture") expect(startCalls).toBe(0);
    });
  it("recovers a server-only uploaded original without creating another capture", async () => {
    const actions: string[] = [];
    const result = await recoverUploadedCapture(
      {
        id: "server-job",
        status: "uploading",
        draft: { name: "Saved form" },
      } as Job,
      async <T>(action: string) => {
        actions.push(action);
        return { uploaded: true } as T;
      },
    );
    expect(result).toBe(true);
    expect(actions).toEqual(["resume-upload", "start-capture"]);
  });
});
