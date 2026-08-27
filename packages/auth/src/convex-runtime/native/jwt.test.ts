import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { getJwtPrivateKey, getJwks, mintToken, verifyToken } from "./jwt.js";

async function setupTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  process.env.JWT_PRIVATE_KEY = JSON.stringify(privateJwk);
  process.env.JWKS = JSON.stringify({ keys: [publicJwk] });
}

describe("jwt", () => {
  beforeAll(setupTestKeys);

  it("mints a token that can be verified", async () => {
    await getJwtPrivateKey();
    const token = await mintToken("user-123", "session-abc");
    expect(typeof token).toBe("string");

    const payload = await verifyToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.sessionId).toBe("session-abc");
    expect(payload.exp).toBeTypeOf("number");
  });

  it("rejects an invalid token", async () => {
    await expect(verifyToken("not-a-token")).rejects.toThrow();
  });

  it("exposes the JWKS", () => {
    const jwks = getJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kty).toBe("RSA");
  });
});
