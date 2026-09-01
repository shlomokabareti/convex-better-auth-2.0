import { SignJWT, createLocalJWKSet, jwtVerify } from "jose";
import { bytesToBase64url } from "./password.js";
import { getJwtPrivateKey, getJwks } from "./jwt.js";

export type OAuthStatePayload = {
  provider: string;
  codeVerifier: string;
  callbackURL?: string;
  errorURL?: string;
  newUserURL?: string;
  requestSignUp?: boolean;
  link?: boolean;
  additionalData?: Record<string, unknown>;
};

function base64url(bytes: Uint8Array): string {
  return bytesToBase64url(bytes);
}

export async function generateCodeVerifier(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(96));
  return base64url(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

export async function mintOAuthState(payload: OAuthStatePayload): Promise<string> {
  const key = await getJwtPrivateKey();
  return await new SignJWT({ state: true, ...payload })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(payload.provider)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

export async function verifyOAuthState(token: string): Promise<OAuthStatePayload> {
  const jwks = createLocalJWKSet(getJwks());
  const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"] });

  if (payload.state !== true) {
    throw new Error("Invalid OAuth state token");
  }
  if (typeof payload.provider !== "string") {
    throw new Error("Invalid OAuth state token: missing provider");
  }
  if (typeof payload.codeVerifier !== "string") {
    throw new Error("Invalid OAuth state token: missing code verifier");
  }

  return {
    provider: payload.provider,
    codeVerifier: payload.codeVerifier,
    callbackURL: typeof payload.callbackURL === "string" ? payload.callbackURL : undefined,
    errorURL: typeof payload.errorURL === "string" ? payload.errorURL : undefined,
    newUserURL: typeof payload.newUserURL === "string" ? payload.newUserURL : undefined,
    requestSignUp: payload.requestSignUp === true,
    link: payload.link === true,
    additionalData:
      typeof payload.additionalData === "object" && payload.additionalData !== null
        ? (payload.additionalData as Record<string, unknown>)
        : undefined,
  };
}
