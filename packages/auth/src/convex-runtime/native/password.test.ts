import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

function legacyScryptHash(password: string): string {
  const salt = randomBytes(32);
  const derived = scryptSync(password, salt, 64);
  return `$scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

describe("password", () => {
  it("hashes and verifies a password with argon2id", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("hunter2", "not-a-hash")).toBe(false);
    expect(await verifyPassword("hunter2", "$scrypt$bad")).toBe(false);
  });

  it("produces different hashes for the same password", async () => {
    const hash1 = await hashPassword("hunter2");
    const hash2 = await hashPassword("hunter2");
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("hunter2", hash1)).toBe(true);
    expect(await verifyPassword("hunter2", hash2)).toBe(true);
  });

  it("still verifies legacy scrypt hashes", async () => {
    const legacyHash = legacyScryptHash("hunter2");
    expect(await verifyPassword("hunter2", legacyHash)).toBe(true);
    expect(await verifyPassword("wrong", legacyHash)).toBe(false);
  });
});
