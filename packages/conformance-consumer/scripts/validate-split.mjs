import { copyFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const convexDir = join(__dirname, "..", "convex");
const splitDir = join(__dirname, "..", "convex-split");

const originals = {
  config: join(convexDir, "convex.config.ts"),
  auth: join(convexDir, "auth.ts"),
};

const split = {
  config: join(splitDir, "convex.config.ts"),
  auth: join(splitDir, "auth.ts"),
};

const backup = {
  config: join(convexDir, "convex.config.ts.bak"),
  auth: join(convexDir, "auth.ts.bak"),
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function swapToSplit() {
  await copyFile(originals.config, backup.config);
  await copyFile(originals.auth, backup.auth);
  await copyFile(split.config, originals.config);
  await copyFile(split.auth, originals.auth);
}

async function restoreFull() {
  await copyFile(backup.config, originals.config);
  await copyFile(backup.auth, originals.auth);
}

async function cleanup() {
  await unlink(backup.config).catch(() => undefined);
  await unlink(backup.auth).catch(() => undefined);
}

try {
  await swapToSplit();
  await run("pnpm", ["exec", "convex", "dev", "--once"], { cwd: join(__dirname, "..") });
  await restoreFull();
  await run("pnpm", ["exec", "convex", "dev", "--once"], { cwd: join(__dirname, "..") });
  await cleanup();
  console.log("Split consumer validation passed and full consumer restored.");
} catch (error) {
  // Best-effort restore even on failure.
  await restoreFull().catch(() => undefined);
  await run("pnpm", ["exec", "convex", "dev", "--once"], { cwd: join(__dirname, "..") }).catch(
    () => undefined,
  );
  await cleanup().catch(() => undefined);
  throw error;
}
