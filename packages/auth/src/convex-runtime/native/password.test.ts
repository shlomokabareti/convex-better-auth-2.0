import { describe, expect, it } from "vitest";
import { hashPassword, legacyPbkdf2Hash, verifyPassword } from "./password.js";

describe("password", () => {
  it("hashes and verifies a password with scrypt", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash.startsWith("$scrypt$")).toBe(true);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("hunter2", "not-a-hash")).toBe(false);
    expect(await verifyPassword("hunter2", "$pbkdf2$bad")).toBe(false);
    expect(await verifyPassword("hunter2", "$scrypt$bad$bad")).toBe(false);
  });

  it("produces different hashes for the same password", async () => {
    const hash1 = await hashPassword("hunter2");
    const hash2 = await hashPassword("hunter2");
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("hunter2", hash1)).toBe(true);
    expect(await verifyPassword("hunter2", hash2)).toBe(true);
  });

  it("still verifies legacy PBKDF2 hashes", async () => {
    const legacyHash = await legacyPbkdf2Hash("hunter2");
    expect(legacyHash.startsWith("$pbkdf2$")).toBe(true);
    expect(await verifyPassword("hunter2", legacyHash)).toBe(true);
    expect(await verifyPassword("wrong", legacyHash)).toBe(false);
  });
});
