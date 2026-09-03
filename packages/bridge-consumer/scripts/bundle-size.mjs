#!/usr/bin/env node
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleDir = join(__dirname, "..", "node_modules", ".cache", "bridge-bundle");

const ISOLATE_LIMIT = 32 * 1024 * 1024;
const TOTAL_LIMIT = 32 * 1024 * 1024;

async function dirSize(dir) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const s = await stat(join(entry.parentPath, entry.name));
      total += s.size;
    }
  }
  return total;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function main() {
  await mkdir(dirname(bundleDir), { recursive: true });
  await rm(bundleDir, { recursive: true, force: true });

  const packageDir = join(__dirname, "..");
  await run(
    "pnpm",
    [
      "exec",
      "convex",
      "dev",
      "--once",
      "--debug-bundle-path",
      bundleDir,
      "--codegen",
      "disable",
      "--typecheck",
      "disable",
    ],
    {
      cwd: packageDir,
    },
  );

  const isolateDir = join(bundleDir, "isolate");
  const nodeDir = join(bundleDir, "node");
  const isolateBytes = await dirSize(isolateDir).catch(() => 0);
  const nodeBytes = await dirSize(nodeDir).catch(() => 0);
  const totalBytes = isolateBytes + nodeBytes;

  const metrics = {
    isolateBytes,
    nodeBytes,
    totalBytes,
    isolateMiB: isolateBytes / (1024 * 1024),
    nodeMiB: nodeBytes / (1024 * 1024),
    totalMiB: totalBytes / (1024 * 1024),
    isolateLimitMiB: ISOLATE_LIMIT / (1024 * 1024),
    totalLimitMiB: TOTAL_LIMIT / (1024 * 1024),
    pass: isolateBytes < ISOLATE_LIMIT && totalBytes < TOTAL_LIMIT,
  };

  console.log(JSON.stringify(metrics, null, 2));

  if (!metrics.pass) {
    console.error("Bridge bundle exceeded the 32 MiB Convex source bundle limit.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
