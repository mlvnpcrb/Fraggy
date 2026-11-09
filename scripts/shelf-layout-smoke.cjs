const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  await page.goto(process.env.TEST_URL || "http://localhost:8083");
  await page.getByTestId("perfume-cabinet").waitFor();
  await page.evaluate(() => {
    const sizes = Array.from(document.querySelectorAll('[dir="auto"]')).map(
      (e) => [e, parseFloat(getComputedStyle(e).fontSize) * 2],
    );
    sizes.forEach(([e, n]) => {
      e.style.fontSize = `${n}px`;
    });
  });
  const box = await page
    .getByText("YOUR COLLECTION", { exact: true })
    .boundingBox();
  assert(
    box && box.x >= 0 && box.x + box.width <= 320,
    `Shelf header must fit 320px with 2x text: ${JSON.stringify(box)}`,
  );
  await browser.close();
  console.log("PASS: shelf header fits at 320px / 2x browser text.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
