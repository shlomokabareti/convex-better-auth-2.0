import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "scripts/cli.ts",
    "scripts/check-consumer-contract.ts",
    "scripts/preflight.ts",
  ],
  format: "esm",
  platform: "node",
  target: "node18",
  bundle: true,
  clean: false,
  outDir: "dist/scripts",
  noExternal: [/@convexnyc\/auth/],
});
