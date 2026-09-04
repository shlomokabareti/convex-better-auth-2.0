#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_PACKAGE = "@convex-dev/better-auth";
const VENDORED_PACKAGE = "convex-better-auth-adapter";

type MigrateArgs = {
  convexDir: string;
  legacyComponent: string;
  authComponent: string;
  dryRun: boolean;
  cutover: boolean;
  resume: boolean;
};

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function run(command: string, args: string[], options?: { cwd?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: options?.cwd,
      env: process.env,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
    child.on("error", (err) => reject(err));
  });
}

function detectPackageManager(cwd: string): string {
  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(cwd, "package-lock.json"))) return "npm";
  return "pnpm";
}

export function swapPackageInPackageJson(content: string): string {
  return content.replace(new RegExp(`"${LEGACY_PACKAGE}"`, "g"), `"${VENDORED_PACKAGE}"`);
}

export function swapPackageInConvexConfig(content: string): string {
  const escaped = LEGACY_PACKAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content
    .replace(new RegExp(`from "${escaped}/convex.config"`, "g"), `from "${VENDORED_PACKAGE}/convex.config"`)
    .replace(new RegExp(`from '${escaped}/convex.config'`, "g"), `from '${VENDORED_PACKAGE}/convex.config'`)
    .replace(new RegExp(`from "${escaped}/convex.config\.js"`, "g"), `from "${VENDORED_PACKAGE}/convex.config.js"`)
    .replace(new RegExp(`from '${escaped}/convex.config\.js'`, "g"), `from '${VENDORED_PACKAGE}/convex.config.js'`);
}

export function parseArgs(argv: string[]): MigrateArgs {
  const args = argv.slice(2);
  let convexDir = "./convex";
  let legacyComponent = "betterAuth";
  let authComponent = "convexAuth";
  let dryRun = false;
  let cutover = false;
  let resume = false;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--convex-dir":
        convexDir = args[++i] ?? convexDir;
        break;
      case "--from-component":
        legacyComponent = args[++i] ?? legacyComponent;
        break;
      case "--auth-component":
        authComponent = args[++i] ?? authComponent;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--cutover":
        cutover = true;
        break;
      case "--resume":
        resume = true;
        break;
    }
  }
  return { convexDir, legacyComponent, authComponent, dryRun, cutover, resume };
}

function rewriteFile(path: string, transform: (s: string) => string, dryRun: boolean): boolean {
  if (!existsSync(path)) return false;
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (before === after) return false;
  if (dryRun) {
    log(`[dry-run] would rewrite ${path}`);
    return true;
  }
  writeFileSync(path, after);
  log(`rewrote ${path}`);
  return true;
}

async function runConvex(args: string[], dryRun: boolean, cwd: string): Promise<void> {
  if (dryRun) {
    log(`[dry-run] would run: pnpm dlx convex ${args.join(" ")}`);
    return;
  }
  return run("pnpm", ["dlx", "convex", ...args], { cwd });
}

export async function main(argv: string[]): Promise<void> {
  const cwd = process.cwd();
  const { convexDir, legacyComponent, authComponent, dryRun, cutover, resume } = parseArgs(argv);

  const packageJsonPath = resolve(cwd, "package.json");
  const convexConfigPath = resolve(cwd, convexDir, "convex.config.ts");

  if (!existsSync(packageJsonPath)) throw new Error(`package.json not found at ${packageJsonPath}`);
  if (!existsSync(convexConfigPath)) throw new Error(`convex.config.ts not found at ${convexConfigPath}`);

  const packageJson = readFileSync(packageJsonPath, "utf8");
  if (!packageJson.includes(LEGACY_PACKAGE) && !packageJson.includes(VENDORED_PACKAGE)) {
    throw new Error(`Neither ${LEGACY_PACKAGE} nor ${VENDORED_PACKAGE} found in package.json`);
  }

  log("Better Auth to convex-auth migration");
  log(`  package.json:  ${packageJsonPath}`);
  log(`  convex dir:    ${convexDir}`);
  log(`  legacy comp:   ${legacyComponent}`);
  log(`  auth comp:     ${authComponent}`);
  if (dryRun) log("  --dry-run: no files or deployments will change");
  if (resume) log("  --resume: continue from the last saved cursor");

  const targets = {
    migrateUserHandle: `${authComponent}/migrate:migrateUser`,
    migrateAccountHandle: `${authComponent}/migrate:migrateAccount`,
    migrateSessionHandle: `${authComponent}/migrate:migrateSession`,
  };

  const needsSwap = packageJson.includes(LEGACY_PACKAGE);
  if (needsSwap) {
    log(`\nswapping ${LEGACY_PACKAGE} → ${VENDORED_PACKAGE}...`);
    rewriteFile(packageJsonPath, swapPackageInPackageJson, dryRun);
    rewriteFile(convexConfigPath, swapPackageInConvexConfig, dryRun);
    if (!dryRun) {
      const pkg = detectPackageManager(cwd);
      log(`running ${pkg} install...`);
      await run(pkg, ["install"], { cwd });
      log("deploying vendored adapter...");
      await runConvex(["dev", "--once"], dryRun, cwd);
    }
  } else {
    log(`\nusing existing ${VENDORED_PACKAGE}...`);
    if (!dryRun) {
      log("deploying...");
      await runConvex(["dev", "--once"], dryRun, cwd);
    }
  }

  log("\nsetting migration targets...");
  await runConvex(
    ["run", "--component", legacyComponent, "migrate:setMigrationTargets", JSON.stringify(targets)],
    dryRun,
    cwd,
  );

  log("\nrunning migration...");
  await runConvex(
    ["run", "--component", legacyComponent, "migrate:migrateAll", JSON.stringify({ resume })],
    dryRun,
    cwd,
  );

  if (cutover) {
    const authTsPath = resolve(cwd, convexDir, "auth.ts");
    const httpTsPath = resolve(cwd, convexDir, "http.ts");
    if (dryRun) {
      log(`[dry-run] would cut over files: ${authTsPath}, ${httpTsPath}, package.json`);
    } else {
      log("\ncutover not yet implemented; run --cutover in a later release.");
    }
  }

  log("\ndone");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
