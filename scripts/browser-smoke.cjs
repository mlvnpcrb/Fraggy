const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
async function run() {
  fs.mkdirSync("artifacts", { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: Number(process.env.TEST_WIDTH) || 390, height: 844 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const tab = (name) => page.getByRole("tab", { name: new RegExp(name) });
  await page.goto(process.env.TEST_URL || "http://localhost:8081", {
    timeout: 120000,
  });
  await button("Add a bottle").waitFor({ timeout: 120000 });
  await button("Open to swap").click();
  assert.equal(
    await page
      .getByRole("button", { name: "View Bleu de Chanel", exact: true })
      .count(),
    0,
  );
  await button("All bottles").click();
  await page.screenshot({ path: "artifacts/shelf.png" });

  await button("Add a bottle").click();
  await button("Add to my shelf  +").click();
  await page
    .getByText("Choose a photo or try the sample cutout first.")
    .waitFor();
  await page.getByRole("button", { name: /Try a sample cutout/ }).click();
  await page.getByLabel("Remaining (%)", { exact: true }).fill("101");
  await button("Add to my shelf  +").click();
  await page
    .getByText("Remaining amount must be between 0 and 100%.", { exact: true })
    .waitFor();
  await page.getByLabel("Remaining (%)", { exact: true }).fill("80");
  await page.screenshot({ path: "artifacts/add-bottle.png" });
  await button("Add to my shelf  +").click();
  await page
    .getByText("6 BOTTLES. ENDLESS POSSIBILITIES.", { exact: true })
    .waitFor();

  await button("Add a bottle").click();
  await page.getByLabel("Brand", { exact: true }).fill("Personal");
  await page.getByLabel("Fragrance name", { exact: true }).fill("Draft bottle");
  const canceledChooser = page.waitForEvent("filechooser");
  await button("Choose photo").click();
  await (await canceledChooser).setFiles([]);
  await button("Choose photo").waitFor();
  assert.equal(
    await page.getByLabel("Fragrance name", { exact: true }).inputValue(),
    "Draft bottle",
  );
  assert.equal(
    await page.getByText("YOUR ORIGINAL PHOTO", { exact: true }).count(),
    0,
  );
  const chooser = page.waitForEvent("filechooser");
  await button("Choose photo").click();
  await (await chooser).setFiles(path.resolve("artifacts/shelf.png"));
  await page.getByText("YOUR ORIGINAL PHOTO", { exact: true }).waitFor();
  await page.getByLabel("Brand", { exact: true }).fill("Personal");
  const longName = "A fragrance with a very long collector edition name";
  await page.getByLabel("Fragrance name", { exact: true }).fill(longName);
  await button("Add to my shelf  +").click();
  await page
    .getByText("7 BOTTLES. ENDLESS POSSIBILITIES.", { exact: true })
    .waitFor();
  await button(`View ${longName}`).click();
  await page.getByText("ORIGINAL PHOTO", { exact: true }).waitFor();
  await button("Go back").click();

  await tab("Discover").click();
  await button("Shipping").click();
  await button("Discover Mojave Ghost").click();
  await button("Shipping").click();
  await button("Offer Santal 33").first().click();
  await button("Propose this swap  ↗").click();
  await button("Simulate Alex M. accepting").click();
  await page.getByText("Both collectors accepted", { exact: true }).waitFor();
  await button("I received my bottle").click();
  await button("Not yet").click();
  assert.equal(
    await page.getByText("You confirmed receipt", { exact: true }).count(),
    0,
  );
  await button("I received my bottle").click();
  await button("Yes, confirm receipt").click();
  await page.getByText("You confirmed receipt", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Swap complete", { exact: true }).count(),
    0,
  );
  await button("Simulate Alex M. receiving").click();
  await page.getByText("Swap complete", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/trade-complete.png" });
  await button("Go back").click();
  await tab("My Shelf").click();
  await button("View Mojave Ghost").waitFor();

  await tab("Trades").click();
  await button("Trade Jazz Club for Hwyl").click();
  await button("Simulate Sam R. accepting").click();
  await button("View exchange details").click();
  await page.getByText("Local meetup preview", { exact: true }).waitFor();
  await button("Report a problem / pause trade").click();
  await page.getByText("Paused · problem reported", { exact: true }).waitFor();
  assert.equal(await button("I received my bottle").count(), 0);
  await button("Go back").click();
  await tab("Profile").click();
  await button("Reset demo collection").click();
  await button("Yes, reset demo").click();
  await tab("My Shelf").click();
  await page
    .getByText("5 BOTTLES. ENDLESS POSSIBILITIES.", { exact: true })
    .waitFor();
  assert.equal(await button("View Mojave Ghost").count(), 0);
  assert.equal(await button(`View ${longName}`).count(), 0);
  assert.equal(await button("View Santal 33").count(), 1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: shelf filters, sample add, validation, original upload, long name, shipping swap, one-sided receipt, completion, local meetup, pause, reset; no runtime errors or horizontal overflow.",
  );
  await browser.close();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
