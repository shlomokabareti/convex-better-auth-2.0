export type DeriveApiKeySecretArgs = {
  derivationSecret: string;
  purpose: string;
  parts: readonly string[];
};

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashApiKeySecret(secret: string): Promise<string> {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function deriveApiKeySecret(args: DeriveApiKeySecretArgs): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.derivationSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode([args.purpose, ...args.parts].join(":")),
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyApiKeySecret(args: {
  secret: string;
  expectedHash: string;
  hashSecret?: (secret: string) => Promise<string>;
}): Promise<boolean> {
  const hashSecret = args.hashSecret ?? hashApiKeySecret;
  return timingSafeEqualString(await hashSecret(args.secret), args.expectedHash);
}

export function timingSafeEqualString(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
