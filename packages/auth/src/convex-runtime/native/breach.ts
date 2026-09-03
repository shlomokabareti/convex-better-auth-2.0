import { bytesToHex } from "@noble/hashes/utils.js";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

export type PasswordBreachCheckResult = { breached: true; count: number } | { breached: false };

/**
 * Check a password against the Have I Been Pwned k-Anonymity API.
 *
 * SHA-1 hashes the password locally, sends only the first 5 hex characters
 * to HIBP, and searches the returned suffix list for the remaining hash.
 *
 * Throws if the HIBP request fails so the caller can decide whether to
 * block the operation or fail open.
 */
export async function checkPasswordBreach(password: string): Promise<PasswordBreachCheckResult> {
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-1", encoder.encode(password));
  const hash = bytesToHex(new Uint8Array(digest)).toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let response: Response;
  try {
    response = await fetch(`${HIBP_RANGE_URL}/${prefix}?addPadding=true`, {
      headers: {
        "User-Agent": "convex-auth password breach checker",
      },
    });
  } catch {
    throw new Error("Failed to check password. Please try again later.");
  }

  if (!response.ok) {
    throw new Error(`Failed to check password. Status: ${response.status}`);
  }

  const body = await response.text();
  for (const line of body.split(/\r?\n/)) {
    const [lineSuffix, countStr] = line.split(":");
    if (lineSuffix?.toUpperCase() === suffix) {
      const count = Number.parseInt(countStr ?? "0", 10);
      if (!Number.isNaN(count) && count > 0) {
        return { breached: true, count };
      }
    }
  }

  return { breached: false };
}
