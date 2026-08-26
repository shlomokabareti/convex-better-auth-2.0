import assert from "node:assert/strict";

import { makeFunctionReference } from "convex/server";
import { afterEach, describe, it } from "vitest";

import { gatedCrons } from "./gatedCrons";

const jobRef = makeFunctionReference<"mutation">("jobs:run");

function exportedCronNames(crons: ReturnType<typeof gatedCrons>): string[] {
  const exportCrons = Reflect.get(crons, "export");
  assert.equal(typeof exportCrons, "function");
  const exported: unknown = Reflect.apply(exportCrons, crons, []);
  if (typeof exported !== "string") {
    throw new TypeError("expected cron export JSON");
  }
  const value: unknown = JSON.parse(exported);
  assert.ok(typeof value === "object" && value !== null);
  return Object.keys(value);
}

describe("gatedCrons", () => {
  afterEach(() => {
    delete process.env.CRONS_ENABLED;
  });

  it("registers nothing and preserves the export contract when CRONS_ENABLED is unset", () => {
    const crons = gatedCrons();

    crons.daily("example", { hourUTC: 0, minuteUTC: 0 }, jobRef);

    assert.deepEqual(exportedCronNames(crons), []);
  });

  it("registers crons when CRONS_ENABLED is true", () => {
    process.env.CRONS_ENABLED = "true";

    const crons = gatedCrons();
    crons.daily("example", { hourUTC: 0, minuteUTC: 0 }, jobRef);

    assert.deepEqual(exportedCronNames(crons), ["example"]);
  });
});
