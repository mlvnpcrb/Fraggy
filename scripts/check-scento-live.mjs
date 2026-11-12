// Run on Node >=22.14 with --experimental-strip-types. curl respects the machine's
// supplied HTTPS proxy and CA settings; no credentials or private bottle photos.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { verifyScento } from "./lib/verify-scento.ts";
const exec = promisify(execFile),
  startedAt = new Date().toISOString(),
  requests = [];
const curlFetch = async (input) => {
  const url = new URL(String(input));
  if (
    url.origin !== "https://www.scento.com" ||
    !url.pathname.startsWith("/api/perfume/v1/")
  )
    throw Error("Verifier only permits official Scento API URLs.");
  const start = Date.now();
  let output;
  try {
    output = await exec(
      "curl",
      [
        "--silent",
        "--show-error",
        "--max-time",
        "10",
        "--max-filesize",
        "100000",
        "--header",
        "Accept: application/json",
        "--write-out",
        "\n%{http_code}",
        url.href,
      ],
      { maxBuffer: 110000, timeout: 12000 },
    );
  } catch (error) {
    requests.push({
      url: url.href,
      status: "network-failure",
      elapsedMs: Date.now() - start,
    });
    throw Error(
      `Live request failed before a usable provider response: ${error.stderr || error.message}`,
    );
  }
  const at = output.stdout.lastIndexOf("\n"),
    status = Number(output.stdout.slice(at + 1)),
    body = output.stdout.slice(0, at);
  requests.push({ url: url.href, status, elapsedMs: Date.now() - start });
  if (status >= 300 && status < 400)
    throw Error(
      `Scento redirected (${status}); review the configured canonical API URL.`,
    );
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
};
let report;
try {
  const result = await verifyScento(curlFetch, (message) =>
    console.log(`CHECK: ${message}`),
  );
  report = {
    status: "passed",
    verification: "live-upstream-through-fraggy-adapter",
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
    requests,
  };
  for (const p of result.profiles)
    console.log(
      `PASS: ${p.brand} · ${p.name} · ${p.noteCount} notes · ${p.sourceUrl}`,
    );
  console.log(
    result.emptySearch
      ? "PASS: unknown-fragrance search returned no matches."
      : `PASS: unknown-fragrance search returned ${result.unknownSearch.suggestionCount} suggestions and no exact name match.`,
  );
  console.log(
    "This verifies the live provider and shared adapter, not the deployed authenticated gateway or physical-phone flow.",
  );
} catch (error) {
  report = {
    status: "failed",
    verification: "live-upstream-through-fraggy-adapter",
    startedAt,
    finishedAt: new Date().toISOString(),
    error: error.message,
    requests,
  };
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/scento-live-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log("Evidence: artifacts/scento-live-verification.json");
