import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/_generated/**", "pnpm-lock.yaml"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/_generated/**"],
  },
});
