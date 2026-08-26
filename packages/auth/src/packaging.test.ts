import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, it } from "vitest";

const componentFiles = [
  "apiKeys.ts",
  "identity.ts",
  "organizations.ts",
  "servicePrincipals.ts",
  "status.ts",
  "webhooks.ts",
] as const;

describe("package component source", () => {
  it("does not depend on sibling workspace source paths", async () => {
    await Promise.all(
      componentFiles.map(async (fileName) => {
        const source = await readFile(
          join(import.meta.dirname, "component", fileName),
          "utf8"
        );
        assert.equal(source.includes("../convex/src"), false, fileName);
        assert.equal(source.includes("../../convex/src"), false, fileName);
        assert.equal(source.includes("email-otp"), false, fileName);
      })
    );
  });
});
