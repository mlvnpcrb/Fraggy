// Interactive publishing helper. Credentials are entered into Expo's CLI,
// never read by Fraggy or written into source files.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const env = { ...process.env, EXPO_PUBLIC_DEMO_MODE: "false" };
function run(args, options = {}) {
  const result = spawnSync(executable, ["--yes", "eas-cli@latest", ...args], {
    stdio: "inherit",
    env,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      `Expo command failed: ${args.join(" ")}. No paid upgrade is authorized.`,
    );
  return result;
}
function identity() {
  const result = spawnSync(executable, ["--yes", "eas-cli@latest", "whoami"], {
    encoding: "utf8",
    env,
  });
  return result.status === 0
    ? result.stdout.replace(/\x1b\[[0-9;]*m/g, "").trim()
    : "";
}
try {
  let account = identity();
  if (!account) {
    run(["login"]);
    account = identity();
  }
  if (!account.split(/\s+/).includes("mlvnpcrb"))
    throw Error(
      "Sign in to Expo as mlvnpcrb before publishing this beta. Run npx eas-cli login in your terminal.",
    );
  run(["update:configure"]);
  const config = JSON.parse(fs.readFileSync("app.json", "utf8"));
  if (!config.expo?.extra?.eas?.projectId)
    throw Error("Expo project linking did not complete.");
  // Expo Go shares the SDK native runtime; an appVersion/fingerprint runtime
  // would target a separate native build instead of the approved Expo Go beta.
  config.expo.runtimeVersion = { policy: "sdkVersion" };
  fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
  run([
    "update",
    "--branch",
    "private-beta",
    "--environment",
    "preview",
    "--platform",
    "all",
    "--message",
    "Fraggy private beta",
  ]);
  console.log(
    "\nOpen the printed Expo dashboard link, select Preview → Expo Go, and test its QR on iPhone and Android with your Mac off. Share the update link/revision for verification.",
  );
  console.log(
    "Commit the generated public Expo project configuration after verifying it; never commit credentials.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
