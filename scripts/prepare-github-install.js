#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const initCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : null;
const shouldForce = process.env.NINEROUTER_FORCE_PREPARE === "1";
const shouldBuild = shouldForce || (initCwd && initCwd !== repoRoot);

if (!shouldBuild) {
  console.log("[9router] prepare: skipping CLI bundle build for local workspace install");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["cli/scripts/build-cli.js"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
