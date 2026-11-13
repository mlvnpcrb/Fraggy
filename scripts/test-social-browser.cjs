const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = process.env.FRAGGY_WEB_EXPORT || "/tmp/fraggy-complete-web";
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(req.url.split("?")[0]);
  const file = path.resolve(
    root,
    "." + (relative === "/" ? "/index.html" : relative),
  );
  if (!file.startsWith(root + "/")) return res.writeHead(403).end();
  try {
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".ttf")
            ? "font/ttf"
            : "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
(async () => {
  await new Promise((r) => server.listen(8096, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const [width, height] of [
      [360, 800],
      [390, 844],
      [430, 932],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } }),
        page = await context.newPage(),
        errors = [];
      let reads = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*.supabase.co/**", async (route) => {
        const request = route.request();
        assert(
          request.url().includes("/rpc/social_read"),
          "Guest must only read the public feed",
        );
        assert(
          !request.headers().authorization,
          "A publishable API key must not be sent as a bearer token",
        );
        reads++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            posts: [],
            profile: null,
            page_enabled: false,
          }),
        });
      });
      await page.goto("http://127.0.0.1:8096");
      await page
        .getByRole("button", { name: "Explore public shelves", exact: true })
        .click();
      await page.getByText("A shelf worth sharing.", { exact: true }).waitFor();
      assert(reads > 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Share bottles", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({ path: `artifacts/public-feed-${width}.png` });
      await page
        .getByRole("button", { name: "Sign in or return", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Sign in or join the beta", exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS public visitor ${width}: bounded anonymous read, no bearer API key, no posting actions, return to sign-in.`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
