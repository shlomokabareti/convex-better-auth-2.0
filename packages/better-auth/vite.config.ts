import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      client: "src/client.ts",
      server: "src/server.ts",
      convex: "src/convex.ts",
    },
    format: "esm",
    dts: true,
    clean: true,
    fixedExtension: false,
    hash: false,
    outDir: "dist",
  },
});
