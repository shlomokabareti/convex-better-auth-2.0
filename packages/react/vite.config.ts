import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "src/index.ts",
    format: "esm",
    dts: { resolve: true },
    clean: true,
    fixedExtension: false,
    hash: false,
    outDir: "dist",
  },
});
