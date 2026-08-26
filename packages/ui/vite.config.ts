import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: "esm",
    dts: true,
    clean: true,
    fixedExtension: false,
    hash: false,
    outDir: "dist",
    deps: {
      neverBundle: ["react", "react-dom", /^radix-ui/, /^@radix-ui/],
    },
  },
});
