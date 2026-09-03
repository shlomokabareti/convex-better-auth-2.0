import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, it } from "vitest";

const publicEntryFiles = ["index.ts", "convex.ts"] as const;

const forbiddenRuntimeImports = [
  'from "better-auth',
  "from 'better-auth",
  'from "convex-better-auth',
  "from 'convex-better-auth",
  'from "better-auth"',
  "from 'better-auth'",
  'from "convex-better-auth"',
  "from 'convex-better-auth'",
] as const;

const componentFiles = [
  "apiKeys.ts",
  "identity.ts",
  "organizations.ts",
  "servicePrincipals.ts",
  "status.ts",
  "webhooks.ts",
] as const;

describe("package public entry points", () => {
  it("does not import from the better-auth runtime in the default convex-auth runtime", async () => {
    await Promise.all(
      publicEntryFiles.map(async (fileName) => {
        const source = await readFile(join(import.meta.dirname, fileName), "utf8");
        for (const forbidden of forbiddenRuntimeImports) {
          assert.equal(
            source.includes(forbidden),
            false,
            `${fileName} must not import from the better-auth runtime: ${forbidden}`,
          );
        }
      }),
    );
  });
});

describe("package component source", () => {
  it("does not depend on sibling workspace source paths", async () => {
    await Promise.all(
      componentFiles.map(async (fileName) => {
        const source = await readFile(join(import.meta.dirname, "component", fileName), "utf8");
        assert.equal(source.includes("../convex/src"), false, fileName);
        assert.equal(source.includes("../../convex/src"), false, fileName);
        assert.equal(source.includes("email-otp"), false, fileName);
      }),
    );
  });
});
