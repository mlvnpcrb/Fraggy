const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = process.env.FRAGGY_WEB_EXPORT || "/tmp/fraggy-complete-web";
const server = http.createServer((req, res) => {
  const file = path.join(
    root,
    decodeURIComponent(req.url.split("?")[0]) === "/"
      ? "index.html"
      : decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const type = file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".ttf")
          ? "font/ttf"
          : "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002";
const base = {
  size_ml: 100,
  remaining_percent: 80,
  image_path: null,
  original_path: null,
  condition_path: null,
  image_kind: "cutout",
  image_width: 200,
  image_height: 400,
  position: 0,
  condition: "good",
  has_cap: true,
  has_box: false,
  trade_available: true,
  reserved_trade_id: null,
  methods: ["local", "shipping"],
  notes: "Good condition",
  version: 1,
};
const bottleA = {
    ...base,
    id: "a",
    owner_id: A,
    brand: "My Brand",
    name: "My Bottle",
    shelf_id: "shelf-a",
  },
  bottleB = {
    ...base,
    id: "b",
    owner_id: B,
    brand: "Their Brand",
    name: "Their Bottle",
    shelf_id: "shelf-b",
  };
fs.mkdirSync("artifacts", { recursive: true });
const state = {
  user_id: A,
  is_admin: false,
  profiles: [
    {
      id: A,
      name: "Alice",
      handle: "@alice",
      city: "Manila",
      bio: "",
      shelf_public: false,
    },
    {
      id: B,
      name: "Bob",
      handle: "@bob",
      city: "Cebu",
      bio: "",
      shelf_public: false,
    },
  ],
  bottles: [bottleA, bottleB],
  shelves: [{ id: "shelf-a", owner_id: A, name: "My collection", position: 0 }],
  trades: [],
  messages: [],
  events: [],
  notifications: [],
  jobs: [
    {
      id: "server-only",
      status: "uploading",
      draft: {},
      original_path: null,
      cutout_path: null,
      updated_at: new Date().toISOString(),
    },
  ],
  reviews: [],
  blocks: [],
  reports: [],
};
(async () => {
  server.listen(8092, "127.0.0.1");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.install();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    "https://flczhwwlvfnkqmtxpkmq.supabase.co/**",
    async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
          },
        });
      let data = {};
      try {
        data = req.postDataJSON() || {};
      } catch {}
      let result = null;
      if (url.pathname.includes("/auth/v1/token")) {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = [
          Buffer.from('{"alg":"HS256"}').toString("base64url"),
          Buffer.from(
            JSON.stringify({ sub: A, exp, role: "authenticated" }),
          ).toString("base64url"),
          "signature",
        ].join(".");
        result = {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: A,
            email: "alice@example.test",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        };
      } else if (url.pathname.includes("/functions/v1/beta-gateway")) {
        if (data.action === "resume-upload") result = { uploaded: true };
        else if (data.action === "start-capture") {
          state.jobs[0].status = "waking";
          result = { job: state.jobs[0] };
        }
      } else if (
        url.pathname.includes("/rpc/beta_state") ||
        url.pathname.includes("/rpc/beta_section")
      )
        result = state;
      else if (url.pathname.includes("/rpc/save_shelf")) {
        state.shelves.push({
          id: "new-shelf",
          owner_id: A,
          name: data.p_name,
          position: 1,
        });
        result = "new-shelf";
      } else if (url.pathname.includes("/rpc/reviewed_propose_trade")) {
        state.trades.push({
          id: "trade1",
          proposer_id: A,
          recipient_id: B,
          offered_bottle_id: "a",
          requested_bottle_id: "b",
          method: data.p_method,
          status: "in-progress",
          accepted_by: [A, B],
          received_by: [],
          cancel_by: [],
          resume_by: [],
          dispatched_by: [],
          exchange: {},
          snapshot: { offered: bottleA, requested: bottleB },
          exchange_note: "",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        });
        result = "trade1";
      } else if (url.pathname.includes("/rpc/send_message")) {
        state.messages.push({
          id: "m1",
          trade_id: "trade1",
          sender_id: A,
          text: data.p_text,
          sent_at: new Date().toISOString(),
        });
        result = "m1";
      } else if (url.pathname.includes("/rpc/confirm_receipt")) {
        state.trades[0].received_by = [A];
      }
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
        body: JSON.stringify(result),
      });
    },
  );
  await page.goto("http://127.0.0.1:8092");
  await page
    .getByRole("button", {
      name: "Sign in or join the private beta",
      exact: true,
    })
    .click();
  await page
    .getByText("Your collection. On display.", { exact: true })
    .waitFor();
  const inputs = page.getByRole("textbox");
  await inputs.nth(0).fill("alice@example.test");
  await page.locator("input[type=password]").fill("correct-password");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByText("My shelf.", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Bleu de Chanel", { exact: true }).count(),
    0,
  );
  await page.getByText("My Bottle", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Discover/ }).click();
  await page
    .getByRole("button", { name: "View bottle", exact: true })
    .waitFor();
  state.bottles = state.bottles.filter((x) => x.id !== bottleB.id); // No realtime event: viewer SELECT was revoked.
  await page.clock.fastForward(61000);
  await page
    .getByText("No available bottles match yet.", { exact: true })
    .waitFor();
  state.bottles.push(bottleB);
  await page.getByRole("tab", { name: /My Shelf/ }).click();
  await page
    .getByRole("button", { name: "Activity and saved captures", exact: true })
    .click();
  await page.getByText("Photo studio · waking", { exact: true }).waitFor();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByRole("textbox").fill("Night shelf");
  await page.getByRole("button", { name: "Create shelf", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Night shelf", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: /Discover/ }).click();
  await page.getByRole("button", { name: "View bottle", exact: true }).click();
  await page
    .getByRole("button", { name: "My Brand · My Bottle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review swap proposal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send proposal and open chat", exact: true })
    .click();
  await page.getByText("The exchange.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "I received the bottle", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm my receipt", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("switch", { name: "I received and checked the agreed bottle" })
    .click();
  await page
    .getByRole("button", { name: "Confirm my receipt", exact: true })
    .click();
  await page
    .getByText(
      "1/2 receipts confirmed. Ownership changes only after both collectors confirm.",
      { exact: true },
    )
    .waitFor();
  await page.screenshot({
    path: path.join(process.cwd(), "artifacts/beta-trade.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mocked browser auth, real cabinet rendering, named shelf UI, proposal navigation and receipt confirmation guard. Database transitions tested separately.",
  );
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
