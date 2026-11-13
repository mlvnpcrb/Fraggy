const { Client } = require("pg");
const assert = require("node:assert/strict");
const url =
  process.env.FRAGGY_TEST_DATABASE_URL ||
  "postgresql://postgres:fraggy-local-test@127.0.0.1:55432/fraggy_beta_test";
const parsed = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  parsed.pathname != "/fraggy_beta_test"
)
  throw Error("Local test database only.");
const db = new Client({ connectionString: url }),
  A = "00000000-0000-4000-8000-000000000061",
  B = "00000000-0000-4000-8000-000000000062";
async function as(id, sql, args = []) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(
        id ? { sub: id, role: "authenticated" } : { role: "anon" },
      ),
    ]);
    await db.query("set local role " + (id ? "authenticated" : "anon"));
    const r = await db.query(sql, args);
    await db.query("commit");
    return r.rows[0];
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
const read = (id, args = []) =>
  as(id, "select public.social_read($1,$2,$3,$4) data", [
    ...args,
    ...[null, false, null, null].slice(args.length),
  ]).then((r) => r.data);
const write = (
  id,
  action,
  target = null,
  text = "",
  bottles = [],
  enabled = true,
) =>
  as(id, "select public.social_write($1,$2,$3,$4,$5) id", [
    action,
    target,
    text,
    bottles,
    enabled,
  ]).then((r) => r.id);
(async () => {
  await db.connect();
  for (const [id, name] of [
    [A, "social_a"],
    [B, "social_b"],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      name + "@example.test",
    ]);
    await db.query(
      "insert into public.profiles(id,handle,name,city,bio)values($1,$2,$3,$4,$5)",
      [id, "@" + name, name, "PRIVATE CITY", "Public bio"],
    );
    await db.query("insert into private.members(user_id)values($1)", [id]);
  }
  const shelf = (
    await db.query(
      "insert into public.shelves(owner_id,name)values($1,$2)returning id",
      [A, "Private shelf"],
    )
  ).rows[0].id;
  const bottle = (
    await db.query(
      "insert into public.bottles(owner_id,shelf_id,brand,name,size_ml,remaining_percent,image_path,original_path,image_kind,notes)values($1,$2,'House','Fragrance',100,90,'public-version.png','private-original.jpg','cutout','SECRET NOTE') returning id",
      [A, shelf],
    )
  ).rows[0].id;
  assert.equal((await read(null)).posts.length, 0);
  await assert.rejects(
    () => write(A, "post", null, "Hello", [bottle]),
    /Enable/,
  );
  await write(A, "page");
  await write(B, "page");
  await assert.rejects(
    () => write(B, "post", null, "Stolen", [bottle]),
    /Only your/,
  );
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('cutouts','public-version.png','{}'),('cutouts','private-original.jpg','{}')",
  );
  const post = await write(A, "post", null, "My rotation", [bottle]);
  assert.equal(
    (
      await as(
        null,
        "select count(*)::int n from storage.objects where name='public-version.png'",
      )
    ).n,
    1,
  );
  assert.equal(
    (
      await as(
        null,
        "select count(*)::int n from storage.objects where name='private-original.jpg'",
      )
    ).n,
    0,
  );
  let page = await read(null);
  assert.equal(page.posts.length, 1);
  assert.equal(page.posts[0].bottles[0].image_path, "public-version.png");
  for (const secret of [
    "PRIVATE CITY",
    "SECRET NOTE",
    "private-original.jpg",
    "shelf_id",
  ])
    assert(!JSON.stringify(page).includes(secret));
  assert.equal(
    (
      await db
        .query("select private.public_cutout('private-original.jpg') ok")
        .then((r) => r.rows[0])
    ).ok,
    false,
  );
  assert.equal(
    (
      await db
        .query("select private.public_cutout('public-version.png') ok")
        .then((r) => r.rows[0])
    ).ok,
    true,
  );
  await assert.rejects(
    () => as(null, "select * from public.shelf_posts"),
    /permission/,
  );
  await assert.rejects(() => write(null, "like", post), /permission/);
  await write(B, "like", post);
  await write(B, "like", post);
  assert.equal((await read(A)).posts[0].likes, 1);
  await write(B, "follow", A);
  await write(B, "follow", A);
  assert.equal((await read(B, [null, true])).posts.length, 1);
  const comment = await write(B, "comment", post, "Great shelf");
  assert.equal((await read(null)).posts[0].comment_count, 1);
  await write(A, "remove-comment", comment);
  assert.equal((await read(null)).posts[0].comment_count, 0);
  await as(B, "select public.block_collector($1,true)", [A]);
  assert.equal((await read(B)).posts.length, 0);
  await assert.rejects(() => write(B, "like", post), /unavailable/);
  assert.equal((await read(null)).posts.length, 1);
  await as(B, "select public.block_collector($1,false)", [A]);
  await write(A, "page", null, "", [], false);
  assert.equal((await read(null)).posts.length, 0);
  assert.equal(
    (
      await db
        .query("select private.public_cutout('public-version.png') ok")
        .then((r) => r.rows[0])
    ).ok,
    false,
  );
  await write(A, "page");
  await db.query(
    "update public.bottles set image_path='replacement.png' where id=$1",
    [bottle],
  );
  assert.equal(
    (await read(null)).posts[0].bottles[0].image_path,
    "public-version.png",
  );
  assert.equal(
    (
      await db
        .query("select private.public_cutout('replacement.png') ok")
        .then((r) => r.rows[0])
    ).ok,
    false,
  );
  await db.query("update private.members set suspended=true where user_id=$1", [
    A,
  ]);
  assert.equal((await read(null)).posts.length, 0);
  await db.query(
    "update private.members set suspended=false where user_id=$1",
    [A],
  );
  await write(A, "remove", post);
  assert.equal((await read(null)).posts.length, 0);
  assert.equal(
    (
      await db
        .query("select private.public_cutout('public-version.png') ok")
        .then((r) => r.rows[0])
    ).ok,
    false,
  );
  console.log(
    "PASS: opt-in public feed, safe projection, private original denial, owner-only posts, idempotent likes/follows, comments, blocks, hidden/suspended pages, immutable cutouts and removal.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
