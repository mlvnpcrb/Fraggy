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
  await new Promise((r) => server.listen(8094, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.FRAGGY_CHROMIUM || "/usr/bin/chromium",
    headless: true,
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
        errors = [],
        network = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (/supabase|scento\.com/.test(r.url())) network.push(r.url());
      });
      await page.goto("http://127.0.0.1:8094");
      await page.getByRole("textbox", { name: "Demo username" }).fill("admin");
      await page.getByLabel("Demo password", { exact: true }).fill("admin");
      await page
        .getByRole("button", { name: "Open isolated demo", exact: true })
        .click();
      await page.getByText("Latest shelves", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Follow @mika", exact: true })
        .click();
      await page.getByRole("tab", { name: "Following", exact: true }).click();
      await page
        .getByText("A little shelf inspiration. Sample post.", { exact: false })
        .waitFor();
      await page
        .getByRole("button", { name: "Like post, 0 likes", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Unlike post, 1 likes", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "0 comments", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Add a comment", exact: true })
        .fill("Beautiful rotation");
      await page
        .getByRole("button", { name: "Post comment", exact: true })
        .click();
      await page.getByText("Beautiful rotation", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Dismiss sheet", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Latest shelves", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Share bottles", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Caption", exact: true })
        .fill("My daily rotation");
      await page
        .getByRole("button", {
          name: "Sample house · Sample fresh",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Publish shelf", exact: true })
        .click();
      await page.getByText("My daily rotation", { exact: false }).waitFor();
      await page.screenshot({
        path: `artifacts/social-feed-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: /My Shelf/ }).click();
      await page.getByText("My shelf.", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "View Sample fresh", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", {
            name: "Add a bottle to this shelf",
            exact: true,
          })
          .count(),
        1,
      );
      await page.waitForFunction(() => {
        const el = document.querySelector(
          '[aria-label="Sample fresh, background removed"]',
        );
        if (!el) return false;
        for (
          let node = el;
          node && node !== document.body;
          node = node.parentElement
        )
          if (Number(getComputedStyle(node).opacity) < 0.99) return false;
        return true;
      });
      fs.mkdirSync("artifacts", { recursive: true });
      await page.screenshot({ path: `artifacts/complete-shelf-${width}.png` });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByRole("tab", { name: /Discover/ }).click();
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Philippine city", exact: true })
        .fill("nowhere");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page
        .getByText("No available bottles match yet.", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      await page
        .getByRole("button", { name: "View bottle", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Sample house · Sample fresh",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Review swap proposal", exact: true })
        .click();
      await page.getByText("Review your swap.", { exact: true }).waitFor();
      await page
        .getByRole("button", {
          name: "Send proposal and open chat",
          exact: true,
        })
        .click();
      await page.getByText("The exchange.", { exact: true }).waitFor();
      await page
        .getByRole("button", {
          name: "Simulate sample collector accepting",
          exact: true,
        })
        .click();
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
        .getByRole("switch", {
          name: "I received and checked the agreed bottle",
          exact: true,
        })
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
      await page.getByRole("button", { name: "← Back", exact: true }).click();
      await page.getByRole("button", { name: "← Back", exact: true }).click();
      await page.getByRole("tab", { name: /My Shelf/ }).click();
      await page
        .getByRole("button", { name: "Capture a bottle", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Use sample bottle photo", exact: true })
        .click();
      await page
        .getByRole("textbox", {
          name: "Search brand or fragrance",
          exact: true,
        })
        .fill("sample");
      await page
        .getByRole("button", {
          name: "Sample house · Sample fragrance · demo fixture",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Use this fragrance", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Continue to cutout inspection",
          exact: true,
        })
        .click();
      await page
        .getByRole("switch", { name: "This cutout looks good", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Continue to bottle details",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Place on my shelf", exact: true })
        .click();
      await page.getByText("My shelf.", { exact: true }).waitFor();
      await page.getByRole("tab", { name: /My Shelf/ }).click();
      await page
        .getByRole("button", { name: "View Sample fragrance", exact: true })
        .waitFor();
      await page.getByRole("tab", { name: /Profile/ }).click();
      await page.getByRole("button", { name: "Wishlist", exact: true }).click();
      await page
        .getByRole("button", { name: "+ Add a fragrance", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: /Enter details myself|Custom fragrance/,
          exact: true,
        })
        .click();
      await page
        .getByRole("textbox", { name: "Brand", exact: true })
        .fill("Custom House");
      await page
        .getByRole("textbox", { name: "Fragrance", exact: true })
        .fill("My rare scent");
      await page
        .getByRole("button", { name: "Save to wishlist", exact: true })
        .click();
      await page
        .getByText("Custom House · My rare scent", { exact: true })
        .waitFor();
      await page.reload();
      await page.getByRole("textbox", { name: "Demo username" }).fill("admin");
      await page.getByLabel("Demo password", { exact: true }).fill("admin");
      await page
        .getByRole("button", { name: "Open isolated demo", exact: true })
        .click();
      await page.getByRole("tab", { name: /My Shelf/ }).click();
      await page
        .getByRole("button", { name: "View Sample fragrance", exact: true })
        .waitFor();
      await page.getByRole("tab", { name: /Profile/ }).click();
      await page.getByRole("button", { name: "Wishlist", exact: true }).click();
      await page
        .getByText("Custom House · My rare scent", { exact: true })
        .waitFor();
      // Enlarged text stress check is browser-only; native dynamic type remains a device gate.
      await page.addStyleTag({
        content:
          '[dir="auto"],input,textarea{font-size:200% !important;line-height:1.5 !important}',
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `artifacts/complete-large-text-${width}.png`,
      });
      assert.deepEqual(
        network,
        [],
        "Demo must never access Supabase or Scento",
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}×${height}: isolated demo, filters, proposal review, guarded receipt, catalog fixture/custom capture, saved shelf/wishlist restart, large-text overflow.`,
      );
      await context.close();
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
