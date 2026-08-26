function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function createConvexWebhookSecret(
  randomUUID: () => string = () => crypto.randomUUID()
): string {
  return `cvxsec_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}

export function getConvexWebhookSecretPreview(secret: string): string {
  return `${secret.slice(0, 10)}...${secret.slice(-6)}`;
}

export async function signConvexWebhookPayload(
  secret: string,
  payload: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify an inbound webhook signature against the shared secret.
 *
 * The package signs OUTBOUND deliveries but historically shipped no verifier,
 * forcing every consumer to hand-roll HMAC comparison (or skip it) on inbound
 * events — the threat model's #1 risk (a forged `user.created` / `member.added`
 * processed as genuine). This is the canonical check: recompute the signature
 * with the SAME routine used to sign, then constant-time compare. Returns
 * `false` for any malformed/absent signature rather than throwing.
 */
export async function verifyConvexWebhookSignature(
  secret: string,
  payload: string,
  signature: string | null | undefined
): Promise<boolean> {
  if (typeof signature !== "string" || signature.length === 0) {
    return false;
  }
  const expected = await signConvexWebhookPayload(secret, payload);
  return constantTimeEqual(signature, expected);
}

/**
 * Read the signature header and verify it against the secret. Mirrors the
 * header names `createConvexWebhookHeaders` writes. Use at the top of any
 * inbound webhook HTTP handler; throw a 403 on `false` before processing.
 */
export async function verifyConvexWebhookRequest(args: {
  secret: string;
  payload: string;
  headers: Headers;
  prefix?: string;
}): Promise<boolean> {
  const prefix = args.prefix ?? "convex";
  const signature = args.headers.get(`x-${prefix}-signature`);
  return verifyConvexWebhookSignature(args.secret, args.payload, signature);
}

/**
 * Length-then-XOR constant-time compare over the hex strings; no early-exit
 * content leak. Length mismatch is folded into the accumulator so the secret's
 * length is not exposed via timing.
 */
function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function createConvexWebhookHeaders(args: {
  eventType: string;
  deliveryId: string;
  signature: string;
  prefix?: string;
}): Record<string, string> {
  const prefix = args.prefix ?? "convex";
  return {
    "content-type": "application/json",
    [`x-${prefix}-delivery`]: args.deliveryId,
    [`x-${prefix}-event`]: args.eventType,
    [`x-${prefix}-signature`]: args.signature,
  };
}
