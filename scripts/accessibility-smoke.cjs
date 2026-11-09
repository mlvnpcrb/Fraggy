const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce",
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto(process.env.TEST_URL || "http://localhost:8083", {
    timeout: 120000,
  });
  await page.getByRole("tab", { name: /Trades/ }).click();
  await button("Trade Jazz Club for Hwyl").click();
  await button("Simulate Sam R. accepting").click();
  await button("I received my bottle").click();
  await page.getByText("Bottle in hand?", { exact: true }).waitFor();
  await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[dir="auto"]'));
    const sizes = elements.map((e) => {
      const s = getComputedStyle(e);
      return [e, parseFloat(s.fontSize) * 3, parseFloat(s.lineHeight) * 3];
    });
    sizes.forEach(([e, size, line]) => {
      e.style.fontSize = `${size}px`;
      if (Number.isFinite(line)) e.style.lineHeight = `${line}px`;
    });
  });
  for (const name of ["Yes, confirm receipt", "Not yet"]) {
    const target = button(name);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    assert(
      box && box.y >= 0 && box.y + box.height <= 667,
      `${name} must be fully reachable at 3x text: ${JSON.stringify(box)}`,
    );
  }
  await button("Not yet").click();
  await button("Report a problem / pause trade").click();
  await page.getByText("Both collectors accepted", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByText("Waiting for mutual acceptance", { exact: true })
      .count(),
    0,
  );
  await button("Go back").click();
  await page.getByRole("tab", { name: /Profile/ }).click();
  await button("Reset demo collection").click();
  await button("Yes, reset demo").click();
  await page.getByRole("tab", { name: /Trades/ }).click();
  await button("Trade Jazz Club for Hwyl").click();
  await button("Report a problem / pause trade").click();
  await page
    .getByText(
      "A problem was reported. This offer stays paused until you reset it. No bottles have been reserved.",
      { exact: true },
    )
    .waitFor();
  await browser.close();
  console.log(
    "PASS: 3x-text receipt controls reachable; paused trade preserves mutual acceptance.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
