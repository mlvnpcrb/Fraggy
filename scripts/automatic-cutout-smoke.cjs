const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto(process.env.TEST_URL || "http://localhost:8083");
  await button("Add a bottle").click();
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/cutout")) requests++;
  });
  async function selectPhoto() {
    const chooser = page.waitForEvent("filechooser");
    await button("Choose photo").click();
    await (
      await chooser
    ).setFiles(path.resolve("server/fixtures/bottle-photo.png"));
  }
  await selectPhoto();
  await page
    .getByText("BACKGROUND REMOVED", { exact: true })
    .waitFor({ timeout: 120000 });
  assert.equal(
    requests,
    1,
    "selecting a photo must start removal without another click",
  );
  assert.equal(await button("Remove background").count(), 0);
  assert.equal(await button("Retry cutout").count(), 0);
  await page.getByLabel("Brand", { exact: true }).fill("Personal");
  await page
    .getByLabel("Fragrance name", { exact: true })
    .fill("Automatic cutout");
  await button("Add to my shelf  +").click();
  await button("View Automatic cutout").waitFor();
  await button("Add a bottle").click();
  await page.route("**/cutout", (r) =>
    r.fulfill({
      status: 503,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({
        detail: "Photo processor unavailable. Retry shortly.",
      }),
    }),
  );
  await selectPhoto();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await button("Remove background").count(),
    0,
    "failure must not become an optional removal choice",
  );
  await button("Retry cutout").waitFor();
  assert.equal(await button("Add to my shelf  +").isDisabled(), true);
  await page.unroute("**/cutout");
  await button("Retry cutout").click();
  await page
    .getByText("BACKGROUND REMOVED", { exact: true })
    .waitFor({ timeout: 120000 });
  assert.equal(await button("Retry cutout").count(), 0);
  await browser.close();
  console.log(
    "PASS: photo selection automatically cuts out, no removal-choice button, failure-only retry, unprocessed Add disabled.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
