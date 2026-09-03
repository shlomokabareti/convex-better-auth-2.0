import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPasswordBreach } from "./breach.js";

async function sha1Hex(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-1", encoder.encode(password));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function hibpBodyFor(suffix: string, count = 1): string {
  return `00001:0\n${suffix}:${count}\nFFFFF:0\n`;
}

describe("checkPasswordBreach", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        text: async () => "",
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns breached: true with the breach count when the suffix is present", async () => {
    const password = "password12345";
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      const requestUrl = typeof url === "string" ? url : url.toString();
      if (requestUrl.includes(`/range/${prefix}?`)) {
        return {
          ok: true,
          status: 200,
          text: async () => hibpBodyFor(suffix, 42),
        };
      }
      return { ok: true, status: 200, text: async () => "" };
    });

    const result = await checkPasswordBreach(password);

    expect(result).toEqual({ breached: true, count: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${prefix}?addPadding=true`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.any(String),
        }),
      }),
    );
  });

  it("returns breached: false when the suffix is absent", async () => {
    const password = `not-breached-${Date.now()}`;
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      const requestUrl = typeof url === "string" ? url : url.toString();
      if (requestUrl.includes(`/range/${prefix}?`)) {
        return { ok: true, status: 200, text: async () => "00001:0\nFFFFF:0\n" };
      }
      return { ok: true, status: 200, text: async () => "" };
    });

    const result = await checkPasswordBreach(password);

    expect(result).toEqual({ breached: false });
  });

  it("ignores zero-count padding entries", async () => {
    const password = "some-password";
    const hash = await sha1Hex(password);
    const suffix = hash.slice(5);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => `00001:0\n${suffix}:0\nFFFFF:0\n`,
    }));

    const result = await checkPasswordBreach(password);

    expect(result).toEqual({ breached: false });
  });

  it("throws when HIBP returns a non-2xx response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    } as Response);

    await expect(checkPasswordBreach("password")).rejects.toThrow("Failed to check password");
  });

  it("throws when the network request fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("network failure"));

    await expect(checkPasswordBreach("password")).rejects.toThrow("Failed to check password");
  });
});
