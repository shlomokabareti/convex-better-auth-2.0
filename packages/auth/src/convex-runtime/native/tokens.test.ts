import { describe, expect, it } from "vitest";
import { generateVerificationToken, hashToken, isTokenExpired, verifyTokenHash } from "./tokens.js";

describe("token utilities", () => {
  it("generates tokens with 64 hex characters", () => {
    const token = generateVerificationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces distinct tokens on successive calls", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });

  it("hashes a token deterministically", async () => {
    const token = generateVerificationToken();
    const hashA = await hashToken(token);
    const hashB = await hashToken(token);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different tokens produce different hashes", async () => {
    const a = await hashToken(generateVerificationToken());
    const b = await hashToken(generateVerificationToken());
    expect(a).not.toBe(b);
  });

  it("verifies a token against its hash", async () => {
    const token = generateVerificationToken();
    const hash = await hashToken(token);
    expect(await verifyTokenHash(token, hash)).toBe(true);
    expect(await verifyTokenHash("wrong-token", hash)).toBe(false);
  });

  it("rejects a hash with the wrong length", async () => {
    const token = generateVerificationToken();
    expect(await verifyTokenHash(token, "short")).toBe(false);
    expect(await verifyTokenHash(token, (await hashToken(token)).slice(0, -2))).toBe(false);
  });

  it("reports expired tokens", () => {
    const now = 1_700_000_000_000;
    expect(isTokenExpired(now - 1, now)).toBe(true);
    expect(isTokenExpired(now + 1, now)).toBe(false);
  });
});
