import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createPkcePair, derivePkceChallenge } from "./pkce";

describe("pkce helpers", () => {
  it("derives the expected S256 challenge", async () => {
    assert.equal(
      await derivePkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("creates a verifier/challenge pair", async () => {
    const pair = await createPkcePair();

    assert.equal(pair.method, "S256");
    assert.equal(pair.verifier.length > 20, true);
    assert.equal(await derivePkceChallenge(pair.verifier), pair.challenge);
  });
});
