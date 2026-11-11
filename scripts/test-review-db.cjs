const { Client } = require("pg");
const assert = require("node:assert/strict");
const url =
  process.env.FRAGGY_TEST_DATABASE_URL ||
  "postgresql://postgres:fraggy-local-test@127.0.0.1:55432/fraggy_beta_test";
const parsed = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  parsed.pathname !== "/fraggy_beta_test"
)
  throw Error("Isolated local fixture DB only.");
const db = new Client({ connectionString: url }),
  D = "00000000-0000-4000-8000-000000000004",
  E = "00000000-0000-4000-8000-000000000005";
let failures = 0;
async function actor(user, sql, args = []) {
  await db.query("savepoint actor");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, role: "authenticated" }),
    ]);
    await db.query("set local role authenticated");
    const result = await db.query(sql, args);
    await db.query("reset role");
    await db.query("release savepoint actor");
    return result;
  } catch (e) {
    await db.query("rollback to savepoint actor");
    await db.query("release savepoint actor");
    throw e;
  }
}
async function bottle(owner, name) {
  return (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'Review',$2,50,80,true)returning id",
      [owner, name],
    )
  ).rows[0].id;
}
async function proposal() {
  const d = await bottle(D, "D"),
    e = await bottle(E, "E");
  return (
    await actor(D, "select public.propose_trade($1,$2,$3) id", [d, e, "local"])
  ).rows[0].id;
}
async function test(name, fn) {
  await db.query("begin");
  try {
    for (const [id, handle] of [
      [D, "@review_d"],
      [E, "@review_e"],
    ]) {
      await db.query("insert into auth.users values($1,$2)", [
        id,
        handle + "@example.test",
      ]);
      await db.query(
        "insert into public.profiles(id,handle,name,city)values($1,$2,$2,$3)",
        [id, handle, "Manila"],
      );
      await db.query("insert into private.members(user_id)values($1)", [id]);
    }
    await fn();
    console.log("PASS:", name);
  } catch (e) {
    failures++;
    console.error("FAIL:", name, "—", e.message);
  } finally {
    await db.query("rollback");
  }
}
async function main() {
  await db.connect();
  await test("cleanup cannot claim a capture finalized after candidate selection", async () => {
    const j = (await actor(D, "select * from public.create_capture()")).rows[0];
    await db.query(
      "update public.capture_jobs set status='ready',width=100,height=200,created_at=now()-interval '8 days' where id=$1",
      [j.id],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata)values('cutouts',$1,'{\"size\":10000}')",
      [j.cutout_path],
    );
    const candidates = (
      await db.query("select public.maintenance_candidates() jobs")
    ).rows[0].jobs;
    assert.ok(candidates.some((x) => x.id === j.id));
    await actor(D, "select public.finalize_capture($1,$2)", [
      j.id,
      { brand: "Brand", name: "Saved", size_ml: 50, remaining_percent: 80 },
    ]);
    const claim = (
      await db.query("select public.claim_capture_cleanup($1) job", [j.id])
    ).rows[0].job;
    assert.equal(claim, null);
  });
  await test("cleanup claim prevents subsequent finalization", async () => {
    const j = (await actor(D, "select * from public.create_capture()")).rows[0];
    await db.query(
      "update public.capture_jobs set status='ready',width=100,height=200,created_at=now()-interval '8 days' where id=$1",
      [j.id],
    );
    assert.ok(
      (await db.query("select public.claim_capture_cleanup($1) job", [j.id]))
        .rows[0].job,
    );
    await assert.rejects(
      () =>
        actor(D, "select public.finalize_capture($1,$2)", [
          j.id,
          { brand: "B", name: "Unsaved", size_ml: 50, remaining_percent: 80 },
        ]),
      /not ready|expired/,
    );
    assert.ok(
      (await db.query("select public.claim_capture_cleanup($1) job", [j.id]))
        .rows[0].job,
      "storage failures must leave cleanup retryable",
    );
  });
  await test("old orphan supplemental photo cannot become newly attached", async () => {
    const path = (
      await actor(D, "select public.extra_photo_ticket($1,$2) path", [
        "avatar",
        100000,
      ])
    ).rows[0].path;
    await db.query(
      "update private.upload_tickets set created_at=now()-interval '8 days' where path=$1",
      [path],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata,created_at)values('cutouts',$1,'{\"size\":1000,\"mimetype\":\"image/jpeg\"}',now()-interval '8 days')",
      [path],
    );
    await assert.rejects(
      () => actor(D, "select public.attach_photo($1)", [path]),
      /ticket|expired|unavailable/,
    );
  });
  await test("paused unaccepted proposal remains declinable", async () => {
    const t = await proposal();
    await actor(D, "select public.pause_trade($1)", [t]);
    await actor(E, "select public.trade_action($1,$2)", [t, "decline"]);
    assert.equal(
      (await db.query("select status from public.trades where id=$1", [t]))
        .rows[0].status,
      "declined",
    );
  });
  await test("paused unaccepted proposal expires", async () => {
    const t = await proposal();
    await actor(D, "select public.pause_trade($1)", [t]);
    await db.query(
      "update public.trades set expires_at=now()-interval '1 day' where id=$1",
      [t],
    );
    await actor(E, "select public.expire_proposals()");
    assert.equal(
      (await db.query("select status from public.trades where id=$1", [t]))
        .rows[0].status,
      "expired",
    );
  });
  await test("unaccepted pause cannot block recipient account deletion", async () => {
    const t = await proposal();
    await actor(D, "select public.pause_trade($1)", [t]);
    await actor(E, "select public.prepare_account_deletion()");
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from private.members where user_id=$1",
          [E],
        )
      ).rows[0].n,
      0,
    );
  });
  await test("completed trade can still be reported without reversing receipt", async () => {
    const t = await proposal();
    await actor(E, "select public.accept_trade($1)", [t]);
    await actor(D, "select public.confirm_receipt($1)", [t]);
    await actor(E, "select public.confirm_receipt($1)", [t]);
    await actor(E, "select public.report_problem(p_trade:=$1,p_reason:=$2)", [
      t,
      "Report after exchange",
    ]);
    assert.equal(
      (await db.query("select status from public.trades where id=$1", [t]))
        .rows[0].status,
      "complete",
    );
  });
  await test("capture admission includes supplemental reservations", async () => {
    for (let i = 0; i < 4; i++)
      await actor(D, "select public.extra_photo_ticket($1,$2)", [
        "condition",
        250000,
      ]);
    const reserved = Number(
      (
        await db.query(
          "select count(*)*1000000 n from public.capture_jobs where bottle_id is null and status<>'expired'",
        )
      ).rows[0].n,
    );
    const used = Number(
      (
        await db.query(
          "select coalesce(sum((metadata->>'size')::bigint),0) n from storage.objects where bucket_id='cutouts'",
        )
      ).rows[0].n,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata)values('cutouts','review-quota',$1)",
      [{ size: 800000000 - reserved - used - 1500000 }],
    );
    await assert.rejects(
      () => actor(D, "select public.create_capture()"),
      /storage is full/,
    );
  });
  await test("expiring a capture does not release a still-valid upload obligation", async () => {
    const j = (await actor(D, "select * from public.create_capture()")).rows[0];
    await db.query(
      "update public.capture_jobs set created_at=now()-interval '8 days' where id=$1",
      [j.id],
    );
    await db.query("select public.record_upload_lease($1)", [j.id]);
    await db.query("select public.claim_capture_cleanup($1)", [j.id]);
    const obligations = Number(
      (
        await db.query(
          "select (select count(*)*1000000 from public.capture_jobs where bottle_id is null and status<>'expired')+(select count(*)*500000 from private.upload_tickets where created_at>now()-interval '2 hours') n",
        )
      ).rows[0].n,
    );
    const used = Number(
      (
        await db.query(
          "select coalesce(sum((metadata->>'size')::bigint),0) n from storage.objects where bucket_id='cutouts'",
        )
      ).rows[0].n,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata)values('cutouts','expired-ticket-quota',$1)",
      [{ size: 800000000 - used - obligations - 1500000 }],
    );
    await assert.rejects(
      () => actor(E, "select public.create_capture()"),
      /storage is full/,
    );
    await assert.rejects(
      () => db.query("select public.record_upload_lease($1)", [j.id]),
      /expired|unavailable/,
    );
  });
  await test("unarchiving cannot exceed 25 active bottles", async () => {
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent)select $1,'B','N',50,50 from generate_series(1,25)",
      [D],
    );
    const archived = await bottle(D, "Archived");
    await db.query("update public.bottles set archived=true where id=$1", [
      archived,
    ]);
    await assert.rejects(
      () =>
        actor(D, "select public.edit_bottle($1,$2)", [
          archived,
          { archived: false },
        ]),
      /25|limit/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from public.bottles where owner_id=$1 and not archived",
          [D],
        )
      ).rows[0].n,
      25,
    );
  });
  await db.end();
  if (failures) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
