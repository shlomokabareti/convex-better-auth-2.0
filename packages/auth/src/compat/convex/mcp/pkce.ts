import { bytesToBase64url } from "../../../convex-runtime/native/password.js";
import type { PkcePair } from "./types";

export async function createPkcePair(): Promise<PkcePair> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes);
  return {
    verifier,
    challenge: await derivePkceChallenge(verifier),
    method: "S256",
  };
}

export async function derivePkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64url(new Uint8Array(digest));
}

function base64UrlEncode(value: Uint8Array): string {
  return bytesToBase64url(value);
}
