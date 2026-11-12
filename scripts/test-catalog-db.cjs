// Only runs against the resettable local database, never the hosted project.
const { Client } = require("pg");
const assert = require("node:assert/strict");
const url =
  process.env.FRAGGY_TEST_DATABASE_URL ||
  "postgresql://postgres:fraggy-local-test@127.0.0.1:55432/fraggy_beta_test";
const parsed = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  parsed.pathname !== "/fraggy_beta_test"
)
  throw Error("Local test database only.");
const db = new Client({ connectionString: url });
const A = "00000000-0000-4000-8000-000000000041",
  B = "00000000-0000-4000-8000-000000000042";
const entry = {
  source: "scento",
  reference: {
    provider: "scento",
    id: "example-edp",
    sourceUrl: "https://www.scento.com/perfumes/example-edp",
    fetchedAt: new Date().toISOString(),
  },
  details: {
    brand: "House",
    name: "Example EDP",
    concentration: "EDP",
    family: null,
    top: ["Citrus"],
    heart: [],
    base: [],
    unstructuredNotes: [],
  },
  overrides: {},
};
async function as(id, sql, args = []) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role: "authenticated" }),
    ]);
    await db.query("set local role authenticated");
    const r = await db.query(sql, args);
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
(async () => {
  await db.connect();
  for (const [id, handle] of [
    [A, "catalog_a"],
    [B, "catalog_b"],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      handle + "@example.test",
    ]);
    await db.query(
      "insert into public.profiles(id,handle,name,city) values($1,$2,$2,$3)",
      [id, "@" + handle, "Manila"],
    );
    await db.query("insert into private.members(user_id)values($1)", [id]);
  }
  const wish = (await as(A, "select public.save_wish($1::jsonb) id", [entry]))
    .rows[0].id;
  assert.equal(
    (await as(A, "select public.save_wish($1::jsonb) id", [entry])).rows[0].id,
    wish,
  );
  assert.equal((await as(B, "select * from public.wishlist")).rowCount, 0);
  await as(B, "select public.remove_wish($1)", [wish]);
  assert.equal((await as(A, "select * from public.wishlist")).rowCount, 1);
  for (const section of [
    "collection",
    "community",
    "trading",
    "account",
    "jobs",
  ])
    assert.ok(
      (await as(A, "select public.beta_section($1) data", [section])).rows[0]
        .data,
    );
  assert.equal(
    (await as(A, "select public.beta_section('account') data")).rows[0].data
      .wishlist.length,
    1,
  );
  const bad = structuredClone(entry);
  bad.reference.sourceUrl = "https://evil.test/perfumes/a";
  await assert.rejects(() =>
    as(A, "select public.save_wish($1::jsonb)", [bad]),
  );
  await assert.rejects(() => as(A, "select public.catalog_cached('anything')"));
  const custom = (concentration) => ({
    ...entry,
    source: "custom",
    reference: null,
    details: { ...entry.details, concentration },
  });
  const edp = (
    await as(A, "select public.save_wish($1::jsonb) id", [custom("EDP")])
  ).rows[0].id;
  const edt = (
    await as(A, "select public.save_wish($1::jsonb) id", [custom("EDT")])
  ).rows[0].id;
  assert.notEqual(edp, edt);
  assert.notEqual(edp, wish);
  assert.equal((await as(A, "select * from public.wishlist")).rowCount, 3);
  const bottle = (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'House','Existing bottle',100,80,true)returning id",
      [A],
    )
  ).rows[0].id;
  await as(A, "select public.edit_bottle($1,$2)", [
    bottle,
    { fragrance: entry },
  ]);
  assert.equal(
    (
      await db.query("select fragrance from public.bottles where id=$1", [
        bottle,
      ])
    ).rows[0].fragrance.reference.id,
    "example-edp",
  );
  assert.equal(
    (await as(A, "select public.preview_shelf() data")).rows[0].data.bottles
      .length,
    1,
  );
  await as(A, "select public.edit_bottle($1,$2)", [
    bottle,
    { trade_available: false },
  ]);
  assert.equal(
    (await as(A, "select public.preview_shelf() data")).rows[0].data.bottles
      .length,
    0,
  );
  const job = (await as(A, "select * from public.create_capture()")).rows[0];
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata)values('cutouts',$1,$2)",
    [job.original_path, { size: 1200 }],
  );
  const ui = {
    version: 1,
    shelfId: "chosen-shelf",
    step: "inspect",
    reviewedCutoutPath: "",
  };
  const retried = (
    await as(A, "select * from public.retry_capture($1,$2)", [
      job.id,
      { brand: "House", name: "EDP", capture_ui: ui },
    ])
  ).rows[0];
  assert.deepEqual(retried.draft.capture_ui, ui);
  await db.query("delete from public.capture_jobs where id=$1", [job.id]);
  await db.query("delete from storage.objects where name=$1", [
    job.original_path,
  ]);
  const other = (
    await db.query(
      "insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,trade_available)values($1,'Other','Another',50,90,true)returning id",
      [B],
    )
  ).rows[0].id;
  await as(A, "select public.edit_bottle($1,$2)", [
    bottle,
    { trade_available: true },
  ]);
  const versions = await db.query(
    "select id,version from public.bottles where id in($1,$2)",
    [bottle, other],
  );
  const version = (id) => versions.rows.find((r) => r.id === id).version;
  await assert.rejects(
    () =>
      as(A, "select public.reviewed_propose_trade($1,$2,$3,$4,$5)", [
        bottle,
        other,
        "local",
        0,
        version(other),
      ]),
    /changed/,
  );
  const trade = (
    await as(A, "select public.reviewed_propose_trade($1,$2,$3,$4,$5) id", [
      bottle,
      other,
      "local",
      version(bottle),
      version(other),
    ])
  ).rows[0].id;
  const snap = (
    await db.query("select snapshot from public.trades where id=$1", [trade])
  ).rows[0].snapshot;
  assert.equal(snap.offered.fragrance.reference.id, "example-edp");
  await as(A, "select public.edit_bottle($1,$2)", [
    bottle,
    { fragrance: { ...entry, overrides: { top: ["Pear"] } } },
  ]);
  assert.equal(
    (
      await db.query("select status,snapshot from public.trades where id=$1", [
        trade,
      ])
    ).rows[0].status,
    "expired",
  );
  assert.deepEqual(
    (await db.query("select snapshot from public.trades where id=$1", [trade]))
      .rows[0].snapshot.offered.fragrance.details.top,
    ["Citrus"],
  );
  for (const table of ["trade_events", "trade_messages", "notifications"])
    await db.query(`delete from public.${table} where trade_id=$1`, [trade]);
  await db.query("delete from public.trades where id=$1", [trade]);
  for (let i = 0; i < 30; i++) await as(A, "select public.catalog_admission()");
  await assert.rejects(
    () => as(A, "select public.catalog_admission()"),
    /Too many/,
  );
  console.log(
    "PASS: private wishlist/idempotency, feature slices, metadata validation, owner privacy preview, cache access denial and catalog rate limit.",
  );
  await db.query("delete from public.wishlist where owner_id in($1,$2)", [
    A,
    B,
  ]);
  await db.query("delete from public.bottles where owner_id in($1,$2)", [A, B]);
  await db.query("delete from private.members where user_id in($1,$2)", [A, B]);
  await db.query("delete from public.profiles where id in($1,$2)", [A, B]);
  await db.query("delete from auth.users where id in($1,$2)", [A, B]);
  await db.end();
})().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exitCode = 1;
});
