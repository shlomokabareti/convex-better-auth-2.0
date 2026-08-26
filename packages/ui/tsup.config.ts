import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  // Bundle only our own source; keep react/radix/cva/etc. external so the
  // consumer provides a single instance. Class name strings survive into dist,
  // so the consumer's Tailwind scans `convex-auth-ui/dist`.
  external: ["react", "react-dom", /^radix-ui/, /^@radix-ui/],
  dts: true,
  clean: true,
  outDir: "dist",
  bundle: true,
  // JSX -> React 19 automatic runtime
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
