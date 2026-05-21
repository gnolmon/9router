#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const Module = require("module");

const APP_VERSION = "__APP_VERSION__";
const DEFAULT_PORT = 20128;
const DEFAULT_HOST = "0.0.0.0";
const appDir = path.resolve(__dirname, "../..");
const runtimeNodeModules = path.join(appDir, "runtime-node_modules");
const requiredServerFilesPath = path.join(appDir, ".next-cli-build", "required-server-files.json");

function printHelp() {
  console.log(`
Usage: 9router [options]

Options:
  -p, --port <port>   Port to run the server (default: ${DEFAULT_PORT})
  -H, --host <host>   Host to bind (default: ${DEFAULT_HOST})
  -n, --no-browser    Accepted for compatibility; no browser auto-open in git installs
  -l, --log           Accepted for compatibility
  -t, --tray          Not supported in git installs
  --skip-update       Accepted for compatibility
  -h, --help          Show this help message
  -v, --version       Show version
`);
}

function parseArgs(argv) {
  let port = DEFAULT_PORT;
  let host = DEFAULT_HOST;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--port" || arg === "-p") {
      port = parseInt(argv[i + 1], 10) || DEFAULT_PORT;
      i += 1;
      continue;
    }

    if (arg === "--host" || arg === "-H") {
      host = argv[i + 1] || DEFAULT_HOST;
      i += 1;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      console.log(APP_VERSION);
      process.exit(0);
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { port, host };
}

function initRuntimeNodePath() {
  const current = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    : [];
  process.env.NODE_PATH = [runtimeNodeModules, ...current].join(path.delimiter);
  Module._initPaths();
}

function loadRuntimeConfig() {
  if (!fs.existsSync(requiredServerFilesPath)) {
    throw new Error(`Missing Next.js manifest: ${requiredServerFilesPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(requiredServerFilesPath, "utf8"));
  const config = { ...(manifest.config || {}) };

  config.distDir = "./.next-cli-build";
  config.outputFileTracingRoot = appDir;

  if (config.turbopack && typeof config.turbopack === "object") {
    config.turbopack = { ...config.turbopack, root: appDir };
  }

  return config;
}

function triggerInit(port) {
  const req = http.get(
    {
      host: "127.0.0.1",
      port,
      path: "/api/init",
      timeout: 5000,
    },
    (res) => {
      res.resume();
      if (res.statusCode && res.statusCode >= 400) {
        console.warn(`[9router] runtime bootstrap returned ${res.statusCode}`);
      }
    }
  );

  req.on("error", (error) => {
    console.warn(`[9router] runtime bootstrap failed: ${error.message}`);
  });
}

async function main() {
  const { port, host } = parseArgs(process.argv.slice(2));
  const config = loadRuntimeConfig();

  process.env.NODE_ENV = "production";
  process.chdir(appDir);

  initRuntimeNodePath();
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);

  require("next");
  const { startServer } = require("next/dist/server/lib/start-server");

  await startServer({
    dir: appDir,
    isDev: false,
    config,
    hostname: host,
    port,
    allowRetry: false,
  });

  triggerInit(port);
  console.log(`[9router] running at http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
}

main().catch((error) => {
  console.error("[9router] failed to start:", error);
  process.exit(1);
});
