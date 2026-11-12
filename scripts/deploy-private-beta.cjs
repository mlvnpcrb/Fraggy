// Interactive deployment using the operator's local CLI sessions. Never reads
// credentials from the CLI store or writes them into the repository/report.
const { spawnSync } = require("node:child_process");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  projectId,
  verifyProjectAccess,
  deployBackend,
} = require("./lib/deployment-guards.cjs");
process.chdir(path.resolve(__dirname, ".."));
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  npm_config_cache:
    process.env.FRAGGY_NPM_CACHE || path.join(os.homedir(), ".npm-fraggy"),
};
const prefix = ["--yes", "supabase@2.81.0"];
function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, { stdio: "inherit", env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      `Deployment stopped: ${binary} ${args.slice(0, 3).join(" ")} failed. Later deployment stages were not run.`,
    );
  return result;
}
const supabase = (args) => command(npx, [...prefix, ...args]);
const capture = (args) => {
  const result = command(npx, [...prefix, ...args], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  process.stdout.write(result.stdout || "");
  return result.stdout || "";
};
const exec = promisify(execFile);
async function http(url, body) {
  const args = [
    "--silent",
    "--show-error",
    "--max-time",
    "60",
    "--max-filesize",
    "100000",
    "--write-out",
    "\n%{http_code}",
  ];
  if (body)
    args.push(
      "--header",
      "Content-Type: application/json",
      "--data",
      JSON.stringify(body),
    );
  args.push(url);
  const { stdout } = await exec("curl", args, {
    env,
    timeout: 65000,
    maxBuffer: 110000,
  });
  const split = stdout.lastIndexOf("\n");
  return {
    status: Number(stdout.slice(split + 1)),
    body: stdout.slice(0, split),
  };
}
const report = {
  projectId,
  startedAt: new Date().toISOString(),
  stages: [],
  published: false,
};
(async () => {
  try {
    console.log(
      "Deploying the reviewed Fraggy beta to its existing Supabase and Expo projects. No new services or paid upgrades are created.",
    );
    console.log(
      "Supabase may open browser sign-in and prompt for your database password. Enter credentials only in its terminal/browser prompts.",
    );
    const probe = spawnSync(
      npx,
      [...prefix, "projects", "list", "--output", "json"],
      { encoding: "utf8", env },
    );
    if (probe.status !== 0) supabase(["login"]);
    verifyProjectAccess(
      JSON.parse(capture(["projects", "list", "--output", "json"])),
    );
    deployBackend(supabase, capture);
    report.stages.push("database-and-gateway-deployed");
    const gatewayUrl = `https://${projectId}.supabase.co/functions/v1/beta-gateway`;
    const denial = await http(gatewayUrl, {
      action: "catalog-search",
      query: "Layton",
    });
    if (denial.status !== 401)
      throw Error(
        `Gateway access check returned HTTP ${denial.status}; expected unauthenticated denial. Publishing stopped.`,
      );
    report.stages.push("unauthenticated-catalog-denied");
    console.log("PASS: hosted gateway denies unauthenticated catalog access.");
    const worker = await http(
      "https://fraggy-cutouts-beta.onrender.com/health",
    );
    if (worker.status !== 200 || JSON.parse(worker.body).status !== "ready")
      throw Error(
        "The existing photo processor is not ready. Publishing stopped; retry after checking Render.",
      );
    report.stages.push("existing-processor-ready");
    console.log("PASS: hosted photo processor is ready.");
    command(process.execPath, [
      "--experimental-strip-types",
      "scripts/check-scento-live.mjs",
    ]);
    report.stages.push("live-scento-check-passed");
    console.log(
      "Publishing an Expo Go preview for device verification. Authenticated capture/trade checks on real phones remain required.",
    );
    command(process.execPath, ["scripts/publish-expo-beta.cjs"]);
    report.published = true;
    report.stages.push("expo-preview-published");
    console.log(
      "Deployment commands completed. Open the Expo update link printed above, choose Expo Go, and test on your iPhone.",
    );
    console.log(
      "Authenticated catalog, capture/save and receipt flows still need a real collector account/device check.",
    );
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
    console.error(error.message);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync("artifacts", { recursive: true });
    fs.writeFileSync(
      "artifacts/deployment-report.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "Deployment status saved to artifacts/deployment-report.json (no credentials).",
    );
  }
})();
