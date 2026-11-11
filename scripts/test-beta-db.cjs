const { Client } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const url =
  process.env.FRAGGY_TEST_DATABASE_URL ||
  "postgresql://postgres:fraggy-local-test@127.0.0.1:55432/fraggy_beta_test";
const parsed = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  parsed.pathname !== "/fraggy_beta_test"
)
  throw Error("Tests only reset the isolated local fraggy_beta_test database.");
const db = new Client({ connectionString: url });
async function asUser(id, sql, args = []) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role: "authenticated" }),
    ]);
    await db.query("set local role authenticated");
    const result = await db.query(sql, args);
    await db.query("commit");
    return result;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
async function main() {
  await db.connect();
  await db.query(`drop schema if exists private cascade;drop schema public cascade;drop schema if exists auth cascade;drop schema if exists storage cascade;create schema public;create schema auth;create schema storage;create schema if not exists extensions;create extension if not exists pgcrypto with schema extensions;
do $$begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role bypassrls;end if;end$$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create table auth.users(id uuid primary key,email text);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create function storage.foldername(name text)returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant select on storage.objects to authenticated;`);
  for (const file of fs
    .readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    console.log("Applying", file);
    await db.query(
      fs.readFileSync(path.join("supabase/migrations", file), "utf8"),
    );
    if(file.includes('baseline_adoption'))await db.query('create index if not exists bottles_owner_idx on public.bottles(owner_id)');
  }
  const A = "00000000-0000-4000-8000-000000000001",
    B = "00000000-0000-4000-8000-000000000002",
    C = "00000000-0000-4000-8000-000000000003";
  for (const [id, n] of [
    [A, "alice"],
    [B, "bob"],
    [C, "carol"],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      n + "@example.test",
    ]);
    await db.query(
      "insert into public.profiles(id,handle,name,city)values($1,$2,$3,$4)",
      [id, "@" + n, n, "Manila"],
    );
    await db.query(
      "insert into private.members(user_id,is_admin)values($1,$2)",
      [id, id === A],
    );
  }
  assert.equal(
    (await db.query("select public from storage.buckets where id='cutouts'"))
      .rows[0].public,
    false,
  );
  const ba = (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'Brand','A',100,80,true)returning id",
      [A],
    )
  ).rows[0].id;
  const bb = (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'Brand','B',100,80,true)returning id",
      [B],
    )
  ).rows[0].id;
  const bc = (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'Private','Hidden',50,70,false)returning id",
      [B],
    )
  ).rows[0].id;
  assert.equal(
    (await asUser(A, "select id from public.bottles where id=$1", [bc]))
      .rowCount,
    0,
    "private bottle must not leak to another member",
  );
  await assert.rejects(
    () =>
      asUser(C, "update public.bottles set owner_id=$1 where id=$2", [C, ba]),
    /permission denied/,
  );
  const t = (
    await asUser(A, "select public.propose_trade($1,$2,$3) as id", [
      ba,
      bb,
      "local",
    ])
  ).rows[0].id;
  await asUser(B, "select public.accept_trade($1)", [t]);
  await asUser(A, "select public.pause_trade($1)", [t]);
  assert.equal(
    (
      await db.query(
        "select reserved_trade_id from public.bottles where id=$1",
        [ba],
      )
    ).rows[0].reserved_trade_id,
    t,
    "paused exchanges must retain reservation",
  );
  await assert.rejects(
    () => asUser(C, "select public.confirm_receipt($1)", [t]),
    /collectors|participant|trade/i,
  );

  await asUser(A, "select public.trade_action($1,$2)", [t, "resume"]);
  await asUser(B, "select public.trade_action($1,$2)", [t, "resume"]);
  await asUser(A, "select public.confirm_receipt($1)", [t]);
  assert.equal(
    (await db.query("select owner_id from public.bottles where id=$1", [ba]))
      .rows[0].owner_id,
    A,
    "one receipt cannot transfer",
  );
  await asUser(A, "select public.confirm_receipt($1)", [t]);
  assert.equal(
    (await db.query("select status from public.trades where id=$1", [t]))
      .rows[0].status,
    "in-progress",
  );
  await asUser(B, "select public.confirm_receipt($1)", [t]);
  await asUser(B, "select public.confirm_receipt($1)", [t]);
  assert.equal(
    (
      await db.query(
        "select owner_id,reserved_trade_id from public.bottles where id=$1",
        [ba],
      )
    ).rows[0].owner_id,
    B,
  );
  assert.equal(
    (await db.query("select owner_id from public.bottles where id=$1", [bb]))
      .rows[0].owner_id,
    A,
  );
  await asUser(A, "select public.review_trade($1,5,$2)", [t, "Good exchange"]);
  await assert.rejects(
    () => asUser(A, "select public.review_trade($1,5)", [t]),
    /duplicate/,
  );
  await assert.rejects(
    () =>
      asUser(B, "select public.configure_worker($1)", ["https://example.com"]),
    /Founder/,
  );
  await assert.rejects(
    () =>
      asUser(A, "select public.configure_worker($1)", ["https://localhost"]),
    /HTTPS/,
  );
  const token = (
    await asUser(A, "select public.configure_worker($1) token", [
      "https://fraggy-test.onrender.com",
    ])
  ).rows[0].token;
  const capture = (await asUser(A, "select * from public.create_capture()"))
    .rows[0];
  await assert.rejects(
    () => asUser(B, "select public.start_capture($1)", [capture.id]),
    /not found/,
  );
  await assert.rejects(
    () => asUser(A, "select public.start_capture($1)", [capture.id]),
    /Upload/,
  );
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata)values(\'cutouts\',$1,\'{"size":200000,"mimetype":"image/jpeg"}\')',
    [capture.original_path],
  );
  await asUser(A, "select public.start_capture($1)", [capture.id]);
  await assert.rejects(
    () => asUser(A, "select public.claim_capture($1,$2)", [capture.id, token]),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("select public.claim_capture($1,$2)", [capture.id, "wrong"]),
    /authorization/,
  );
  const claimed = (
    await db.query("select * from public.claim_capture($1,$2)", [
      capture.id,
      token,
    ])
  ).rows[0];
  assert.ok(claimed.lease_id);
  assert.notEqual(claimed.cutout_path, capture.cutout_path);
  await db.query("select public.complete_capture($1,$2,$3,0,0,$4)", [
    capture.id,
    claimed.lease_id,
    token,
    "retry",
  ]);
  await asUser(A, "select public.start_capture($1)", [capture.id]);
  const retry = (
    await db.query("select * from public.claim_capture($1,$2)", [
      capture.id,
      token,
    ])
  ).rows[0];
  assert.notEqual(
    retry.cutout_path,
    claimed.cutout_path,
    "new lease must get an immutable new output path",
  );
  assert.equal(
    (
      await db.query("select public.complete_capture($1,$2,$3,300,600) ok", [
        capture.id,
        claimed.lease_id,
        token,
      ])
    ).rows[0].ok,
    false,
    "stale lease cannot complete",
  );
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata)values(\'cutouts\',$1,\'{"size":100000,"mimetype":"image/png"}\')',
    [retry.cutout_path],
  );
  await db.query("select public.complete_capture($1,$2,$3,300,600)", [
    capture.id,
    retry.lease_id,
    token,
  ]);
  const rerun = (
    await asUser(A, "select * from public.retry_capture($1,$2)", [
      capture.id,
      {},
    ])
  ).rows[0];
  assert.equal(
    rerun.status,
    "queued",
    "ready cutouts must support a real new processing attempt",
  );
  const third = (
    await db.query("select * from public.claim_capture($1,$2)", [
      capture.id,
      token,
    ])
  ).rows[0];
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata)values(\'cutouts\',$1,\'{"size":100000,"mimetype":"image/png"}\')',
    [third.cutout_path],
  );
  await db.query("select public.complete_capture($1,$2,$3,300,600)", [
    capture.id,
    third.lease_id,
    token,
  ]);
  retry.cutout_path = third.cutout_path;
  const form = {
    brand: "Real",
    name: "PNG",
    size_ml: 100,
    remaining_percent: 80,
    methods: ["local", "shipping"],
  };
  const saved = (
    await asUser(A, "select public.finalize_capture($1,$2) id", [
      capture.id,
      form,
    ])
  ).rows[0].id;
  assert.equal(
    (
      await asUser(A, "select public.finalize_capture($1,$2) id", [
        capture.id,
        form,
      ])
    ).rows[0].id,
    saved,
    "repeat finalization cannot duplicate bottle",
  );
  assert.equal(
    (
      await asUser(B, "select name from storage.objects where name=$1", [
        retry.cutout_path,
      ])
    ).rowCount,
    0,
    "private PNG must be hidden",
  );
  await asUser(A, "select public.update_profile($1)", [{ shelf_public: true }]);
  assert.equal(
    (
      await asUser(B, "select name from storage.objects where name=$1", [
        retry.cutout_path,
      ])
    ).rowCount,
    1,
    "explicit shelf sharing authorizes photos",
  );
  await asUser(A, "select public.update_profile($1)", [
    { shelf_public: false },
  ]);
  await assert.rejects(
    () =>
      asUser(B, "select public.attach_photo($1,$2)", [
        retry.cutout_path,
        saved,
      ]),
    /ticket/,
  );
  const invite = (await asUser(A, "select public.admin_invite() code")).rows[0]
    .code;
  const claim = (
    await db.query("select public.claim_invite($1,$2) claim", [
      invite,
      "new@example.test",
    ])
  ).rows[0].claim;
  await assert.rejects(
    () =>
      db.query("select public.claim_invite($1,$2)", [
        invite,
        "new@example.test",
      ]),
    /invalid/,
  );
  await db.query("select public.release_invite($1)", [claim.claim]);
  assert.ok(
    (
      await db.query("select public.claim_invite($1,$2) claim", [
        invite,
        "new@example.test",
      ])
    ).rows[0].claim.claim,
  );
  // Independent bottles for cancellation, dispatch and competing proposal tests.
  async function bottle(owner, name) {
    return (
      await db.query(
        "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available,methods)values($1,'B',$2,100,80,true,array['local','shipping'])returning id",
        [owner, name],
      )
    ).rows[0].id;
  }
  const x = await bottle(A, "X"),
    y = await bottle(B, "Y"),
    z = await bottle(C, "Z");
  const t2 = (
    await asUser(A, "select public.propose_trade($1,$2,$3) id", [
      x,
      y,
      "shipping",
    ])
  ).rows[0].id;
  const t3 = (
    await asUser(C, "select public.propose_trade($1,$2,$3) id", [
      z,
      y,
      "shipping",
    ])
  ).rows[0].id;
  await asUser(B, "select public.accept_trade($1)", [t2]);
  await assert.rejects(
    () => asUser(B, "select public.accept_trade($1)", [t3]),
    /no longer/,
  );
  await assert.rejects(
    () =>
      asUser(A, "select public.edit_bottle($1,$2)", [x, { name: "Changed" }]),
    /Reserved/,
  );
  await asUser(A, "select public.trade_action($1,$2)", [t2, "cancel"]);
  assert.equal(
    (
      await db.query(
        "select reserved_trade_id from public.bottles where id=$1",
        [x],
      )
    ).rows[0].reserved_trade_id,
    t2,
  );
  await assert.rejects(
    () => asUser(B, "select public.confirm_receipt($1)", [t2]),
    /cancellation/,
  );
  await asUser(B, "select public.trade_action($1,$2)", [t2, "cancel"]);
  assert.equal(
    (
      await db.query(
        "select reserved_trade_id from public.bottles where id=$1",
        [x],
      )
    ).rows[0].reserved_trade_id,
    null,
  );
  const t4 = (
    await asUser(A, "select public.propose_trade($1,$2,$3) id", [
      x,
      y,
      "shipping",
    ])
  ).rows[0].id;
  await asUser(B, "select public.accept_trade($1)", [t4]);
  await asUser(A, "select public.trade_action($1,$2,$3)", [
    t4,
    "dispatch",
    { carrier: "LBC", tracking: "LOCAL-TEST" },
  ]);
  await assert.rejects(
    () => asUser(B, "select public.trade_action($1,$2)", [t4, "cancel"]),
    /started/,
  );
  await asUser(A, "select public.block_collector($1)", [B]);
  await asUser(A, "select public.send_message($1,$2)", [
    t4,
    "Resolve this existing exchange",
  ]);
  await asUser(B, "select public.report_problem(p_trade:=$1,p_reason:=$2)", [
    t4,
    "Bottle issue",
  ]);
  assert.equal(
    (await db.query("select status from public.trades where id=$1", [t4]))
      .rows[0].status,
    "paused",
  );
  await assert.rejects(
    () => asUser(A, "select public.confirm_receipt($1)", [t4]),
    /pause/,
  );
  await assert.rejects(
    () => asUser(A, "select public.prepare_account_deletion()"),
    /Resolve/,
  );
  // Quotas, expiry, and simultaneous acceptances use the real SQL operations.
  await asUser(A, "select public.block_collector($1,false)", [B]);
  const one = await bottle(A, "Concurrent A"),
    two = await bottle(B, "Concurrent B"),
    three = await bottle(C, "Concurrent C");
  const c1 = (
    await asUser(A, "select public.propose_trade($1,$2,$3) id", [
      one,
      two,
      "local",
    ])
  ).rows[0].id;
  const c2 = (
    await asUser(C, "select public.propose_trade($1,$2,$3) id", [
      three,
      two,
      "local",
    ])
  ).rows[0].id;
  async function acceptConcurrently(tid) {
    const connection = new Client({ connectionString: url });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query(
        "select set_config('request.jwt.claims',$1,true)",
        [JSON.stringify({ sub: B, role: "authenticated" })],
      );
      await connection.query("set local role authenticated");
      await connection.query("select public.accept_trade($1)", [tid]);
      await connection.query("commit");
    } catch (e) {
      await connection.query("rollback");
      throw e;
    } finally {
      await connection.end();
    }
  }
  const attempts = await Promise.allSettled([
    acceptConcurrently(c1),
    acceptConcurrently(c2),
  ]);
  assert.equal(
    attempts.filter((x) => x.status === "fulfilled").length,
    1,
    "competing acceptances reserve only one offer",
  );
  const winner = (
    await db.query(
      "select id from public.trades where id=any($1) and status='in-progress' ",
      [[c1, c2]],
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select reserved_trade_id from public.bottles where id=$1",
        [two],
      )
    ).rows[0].reserved_trade_id,
    winner,
  );
  const exA = await bottle(A, "Expiry A"),
    exC = await bottle(C, "Expiry C");
  const expiry = (
    await asUser(A, "select public.propose_trade($1,$2,$3) id", [
      exA,
      exC,
      "local",
    ])
  ).rows[0].id;
  await db.query(
    "update public.trades set expires_at=now()-interval '1 second' where id=$1",
    [expiry],
  );
  await assert.rejects(
    () => asUser(C, "select public.accept_trade($1)", [expiry]),
    /no longer/,
  );
  await asUser(A, "select public.expire_proposals()");
  assert.equal(
    (await db.query("select status from public.trades where id=$1", [expiry]))
      .rows[0].status,
    "expired",
  );
  const oldjob = (await asUser(C, "select * from public.create_capture()"))
    .rows[0];
  await db.query(
    "update public.capture_jobs set created_at=now()-interval '8 days' where id=$1",
    [oldjob.id],
  );
  assert.ok(
    (
      await db.query("select public.maintenance_candidates() jobs")
    ).rows[0].jobs.some((j) => j.id === oldjob.id),
  );
  await db.query("select public.expire_capture($1)", [oldjob.id]);
  await assert.rejects(
    () => asUser(C, "select public.start_capture($1)", [oldjob.id]),
    /not found/,
  );
  for (let i = 0; i < 10; i++)
    await asUser(C, "select public.extra_photo_ticket($1,$2)", [
      "avatar",
      100000,
    ]);
  await assert.rejects(
    () =>
      asUser(C, "select public.extra_photo_ticket($1,$2)", ["avatar", 100000]),
    /Daily/,
  );
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata)values('cutouts','quota-test','{\"size\":800000000}')",
  );
  await assert.rejects(
    () => asUser(C, "select public.create_capture()"),
    /storage is full/,
  );
  await db.query("delete from storage.objects where name='quota-test'");
  const existingCaptures = Number(
    (
      await db.query(
        "select count(*) n from public.capture_jobs where owner_id=$1 and created_at>=date_trunc('day',now())",
        [C],
      )
    ).rows[0].n,
  );
  for (let i = existingCaptures; i < 10; i++)
    await asUser(C, "select public.create_capture()");
  await assert.rejects(
    () => asUser(C, "select public.create_capture()"),
    /Daily photo/,
  );
  await db.query(
    "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent)select $1,'Limit','Bottle',50,50 from generate_series(1,25-(select count(*)::integer from public.bottles where owner_id=$1 and not archived))",
    [C],
  );
  await assert.rejects(
    () => asUser(C, "select public.create_capture()"),
    /25 bottles/,
  );
  await assert.rejects(
    () => asUser(B, "select public.admin_state()"),
    /Founder/,
  );
  await db.query("begin");
  await db.query("set local role anon");
  await assert.rejects(
    () => db.query("select * from public.bottles"),
    /permission denied/,
  );
  await db.query("rollback");
  console.log(
    "PASS: RLS/private media, ownership denial, receipts/idempotency, disputes/blocks, cancellation/dispatch, immutable job leases, finalization, invite claims, simultaneous reservations, expiry and quotas.",
  );
  await db.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
