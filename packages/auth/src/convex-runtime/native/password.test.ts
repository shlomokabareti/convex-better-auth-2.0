import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password", () => {
  it("hashes and verifies a password", () => {
    const hash = hashPassword("hunter2");
    expect(hash.startsWith("$scrypt$")).toBe(true);
    expect(verifyPassword("hunter2", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("hunter2", "not-a-hash")).toBe(false);
    expect(verifyPassword("hunter2", "$scrypt$bad")).toBe(false);
  });

  it("produces different hashes for the same password", () => {
    const hash1 = hashPassword("hunter2");
    const hash2 = hashPassword("hunter2");
    expect(hash1).not.toBe(hash2);
    expect(verifyPassword("hunter2", hash1)).toBe(true);
    expect(verifyPassword("hunter2", hash2)).toBe(true);
  });
});
