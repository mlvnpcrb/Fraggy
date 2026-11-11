const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
process.chdir(root);
const envDir = path.join(root, ".cutout-venv");
const python = path.join(
  envDir,
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!fs.existsSync(python)) {
  console.log(
    "Setting up Fraggy’s local photo processor (Python 3.11+ required)…",
  );
  run(process.platform === "win32" ? "python" : "python3", [
    "-m",
    "venv",
    envDir,
  ]);
}
const requirements = fs.readFileSync("server/requirements.txt");
const digest = crypto.createHash("sha256").update(requirements).digest("hex");
const marker = path.join(envDir, "fraggy-requirements");
if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8") !== digest) {
  run(python, ["-m", "pip", "install", "-r", "server/requirements.txt"]);
  fs.writeFileSync(marker, digest);
}
run(python,["-c","import os; os.environ['FRAGGY_MODEL_DOWNLOAD']='1'; from server.cutout import _session; _session()"]);
console.log(
  "Photo processor: http://0.0.0.0:8787 — keep this terminal open. The model is ready. This server is only used in explicit demo mode.",
);
const child = spawn(
  python,
  ["-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8787"],
  { stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
