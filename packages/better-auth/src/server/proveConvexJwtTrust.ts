import { createRemoteJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";

import { createConvexAuthConfig } from "./createConvexAuthConfig";

export type ConvexJwtTrustProofResult = {
  issuer: string;
  jwks: string;
  validTokenVerified: true;
  wrongIssuerRejected: true;
  wrongAudienceRejected: true;
  wrongKeyRejected: true;
};

type JwksDoc = {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  alg: "RS256";
};

export async function proveConvexJwtTrust(): Promise<ConvexJwtTrustProofResult> {
  const processEnv = (
    globalThis as typeof globalThis & {
      process: { env: Record<string, string | undefined> };
    }
  ).process.env;

  processEnv.CONVEX_SITE_URL = processEnv.CONVEX_SITE_URL ?? "https://sandbox.example.com";

  const primary = await createJwksDoc("primary-key");
  const secondary = await createJwksDoc("secondary-key");
  const provider = createConvexAuthConfig({
    jwks: JSON.stringify([primary]),
  });
  const jwks = createRemoteJWKSet(new URL(provider.jwks));

  const validToken = await createSignedToken({
    issuer: provider.issuer,
    audience: provider.applicationID,
    keyId: primary.id,
    privateKey: primary.privateKey,
  });

  await jwtVerify(validToken, jwks, {
    issuer: provider.issuer,
    audience: provider.applicationID,
    algorithms: [provider.algorithm],
  });

  await assertJwtRejected(
    createSignedToken({
      issuer: "https://wrong-issuer.example.com",
      audience: provider.applicationID,
      keyId: primary.id,
      privateKey: primary.privateKey,
    }),
    jwks,
    {
      issuer: provider.issuer,
      audience: provider.applicationID,
      algorithms: [provider.algorithm],
    },
  );

  await assertJwtRejected(
    createSignedToken({
      issuer: provider.issuer,
      audience: "wrong-audience",
      keyId: primary.id,
      privateKey: primary.privateKey,
    }),
    jwks,
    {
      issuer: provider.issuer,
      audience: provider.applicationID,
      algorithms: [provider.algorithm],
    },
  );

  await assertJwtRejected(
    createSignedToken({
      issuer: provider.issuer,
      audience: provider.applicationID,
      keyId: secondary.id,
      privateKey: secondary.privateKey,
    }),
    jwks,
    {
      issuer: provider.issuer,
      audience: provider.applicationID,
      algorithms: [provider.algorithm],
    },
  );

  return {
    issuer: provider.issuer,
    jwks: provider.jwks,
    validTokenVerified: true,
    wrongIssuerRejected: true,
    wrongAudienceRejected: true,
    wrongKeyRejected: true,
  };
}

async function createJwksDoc(id: string): Promise<JwksDoc> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  return {
    id,
    publicKey: JSON.stringify(publicJwk),
    privateKey: JSON.stringify(privateJwk),
    createdAt: Date.now(),
    alg: "RS256",
  };
}

async function createSignedToken(args: {
  issuer: string;
  audience: string;
  keyId: string;
  privateKey: string;
}) {
  return new SignJWT({
    sub: "user_demo",
    scope: "profile",
  })
    .setProtectedHeader({ alg: "RS256", kid: args.keyId })
    .setIssuer(args.issuer)
    .setAudience(args.audience)
    .setSubject("user_demo")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(
      await crypto.subtle.importKey(
        "jwk",
        JSON.parse(args.privateKey),
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
        false,
        ["sign"],
      ),
    );
}

async function assertJwtRejected(
  tokenPromise: Promise<string>,
  jwks: ReturnType<typeof createRemoteJWKSet>,
  options: {
    issuer: string;
    audience: string;
    algorithms: string[];
  },
) {
  const token = await tokenPromise;

  try {
    await jwtVerify(token, jwks, options);
  } catch {
    return;
  }

  throw new Error("Expected JWT verification to fail");
}
