import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, it } from "vitest";

const forbiddenStrings = [
  "better-auth",
  "convex-better-auth-adapter",
  "better-auth-adapter",
] as const;

describe("package public bundle", () => {
  it("does not include better-auth runtime strings in the default dist/index.js", async () => {
    const bundle = await readFile(
      join(import.meta.dirname, "..", "dist", "index.js"),
      "utf8",
    );
    for (const forbidden of forbiddenStrings) {
      assert.equal(
        bundle.includes(forbidden),
        false,
        `dist/index.js must not contain "${forbidden}"`,
      );
    }
  });
});
