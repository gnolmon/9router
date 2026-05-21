#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const initCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : null;
const shouldForce = process.env.NINEROUTER_FORCE_PREPARE === "1";
const shouldBuild = shouldForce || (initCwd && initCwd !== repoRoot);
const bundledCliArtifacts = [
  path.join(repoRoot, "cli", "app", "server.js"),
  path.join(repoRoot, "cli", "app", "package.json"),
  path.join(repoRoot, "cli", "app", ".next-cli-build"),
  path.join(repoRoot, "cli", "app", "runtime-node_modules"),
];
const hasBundledCliArtifacts = bundledCliArtifacts.every((artifactPath) =>
  fs.existsSync(artifactPath)
);

if (!shouldBuild) {
  console.log("[9router] prepare: skipping CLI bundle build for local workspace install");
  process.exit(0);
}

if (hasBundledCliArtifacts) {
  console.log("[9router] prepare: using bundled CLI artifacts from repository");
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
