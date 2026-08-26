import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { requireActiveServicePrincipal } from "./requireActiveServicePrincipal";

describe("requireActiveServicePrincipal", () => {
  it("allows active service principal", () => {
    assert.doesNotThrow(() =>
      requireActiveServicePrincipal({
        status: "active",
      })
    );
  });

  it("rejects disabled service principal", () => {
    assert.throws(
      () =>
        requireActiveServicePrincipal({
          status: "disabled",
        }),
      /Service principal is not active: disabled/
    );
  });
});
