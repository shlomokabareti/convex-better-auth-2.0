import {
  buildMcpOAuthJwks,
  createMcpOAuthSigningKeyRecord,
  signMcpOAuthAccessToken,
  verifyMcpOAuthAccessToken,
} from "./signing";
import type {
  McpOAuthAccessTokenClaims,
  McpOAuthAccessTokenVerificationResult,
  McpOAuthJwks,
  McpOAuthSignedAccessToken,
  McpOAuthSigningKeyPublicationRecord,
  McpOAuthSigningKeyRecord,
} from "./types";

export type McpOAuthStoredSigningKeyRecord = McpOAuthSigningKeyRecord &
  Partial<McpOAuthSigningKeyPublicationRecord>;

export type EnsureMcpOAuthSigningKeyArgs<
  TSigningKeyRecord extends McpOAuthStoredSigningKeyRecord = McpOAuthStoredSigningKeyRecord,
> = {
  loadActiveSigningKey: () => Promise<TSigningKeyRecord | null> | TSigningKeyRecord | null;
  persistSigningKey: (signingKey: McpOAuthSigningKeyRecord) => Promise<void> | void;
  createSigningKey?: () => Promise<McpOAuthSigningKeyRecord> | McpOAuthSigningKeyRecord;
};

export type RotateMcpOAuthSigningKeyArgs<
  TSigningKeyRecord extends McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord =
    McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord,
> = {
  listSigningKeys: () => Promise<readonly TSigningKeyRecord[]> | readonly TSigningKeyRecord[];
  persistSigningKey: (signingKey: McpOAuthSigningKeyRecord) => Promise<void> | void;
  retireSigningKey: (args: { keyId: string; retiredAt: number }) => Promise<void> | void;
  createSigningKey?: () => Promise<McpOAuthSigningKeyRecord> | McpOAuthSigningKeyRecord;
  now?: number;
};

export type RotateMcpOAuthSigningKeyResult<
  TSigningKeyRecord extends McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord =
    McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord,
> = {
  activeKey: TSigningKeyRecord | null;
  rotatedAt: number;
  signingKey: McpOAuthSigningKeyRecord;
};

export async function ensureMcpOAuthSigningKey<
  TSigningKeyRecord extends McpOAuthStoredSigningKeyRecord = McpOAuthStoredSigningKeyRecord,
>(args: EnsureMcpOAuthSigningKeyArgs<TSigningKeyRecord>): Promise<McpOAuthSigningKeyRecord> {
  const existing = await args.loadActiveSigningKey();
  if (existing !== null) {
    return existing;
  }

  const created = await (args.createSigningKey?.() ?? createMcpOAuthSigningKeyRecord());
  await args.persistSigningKey(created);
  return created;
}

export async function buildMcpOAuthPublicJwks<
  TSigningKeyRecord extends McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord =
    McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord,
>(args: {
  ensureSigningKey?: () => unknown;
  listSigningKeys: () => Promise<readonly TSigningKeyRecord[]> | readonly TSigningKeyRecord[];
  now?: number;
}): Promise<McpOAuthJwks> {
  await args.ensureSigningKey?.();
  const keys = await args.listSigningKeys();
  return buildMcpOAuthJwks({
    keys: [...keys],
    now: args.now,
  });
}

export async function signMcpOAuthAccessTokenWithStoredKey<
  TSigningKeyRecord extends McpOAuthStoredSigningKeyRecord = McpOAuthStoredSigningKeyRecord,
>(
  args: EnsureMcpOAuthSigningKeyArgs<TSigningKeyRecord> & {
    issuer: string;
    audience: string;
    subject: string;
    claims: McpOAuthAccessTokenClaims;
    expiresInSeconds?: number;
    now?: number;
  },
): Promise<McpOAuthSignedAccessToken> {
  const signingKey = await ensureMcpOAuthSigningKey(args);
  return await signMcpOAuthAccessToken({
    signingKey,
    issuer: args.issuer,
    audience: args.audience,
    subject: args.subject,
    claims: args.claims,
    expiresInSeconds: args.expiresInSeconds,
    now: args.now,
  });
}

export async function verifyMcpOAuthAccessTokenWithStoredKeys<
  TSigningKeyRecord extends McpOAuthSigningKeyRecord = McpOAuthSigningKeyRecord,
>(args: {
  accessToken: string;
  issuer: string;
  audience: string;
  ensureSigningKey?: () => unknown;
  listSigningKeys: () => Promise<readonly TSigningKeyRecord[]> | readonly TSigningKeyRecord[];
}): Promise<McpOAuthAccessTokenVerificationResult> {
  await args.ensureSigningKey?.();
  const signingKeys = await args.listSigningKeys();
  return await verifyMcpOAuthAccessToken({
    accessToken: args.accessToken,
    signingKeys: [...signingKeys],
    issuer: args.issuer,
    audience: args.audience,
  });
}

export async function rotateMcpOAuthSigningKey<
  TSigningKeyRecord extends McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord =
    McpOAuthSigningKeyRecord & McpOAuthSigningKeyPublicationRecord,
>(
  args: RotateMcpOAuthSigningKeyArgs<TSigningKeyRecord>,
): Promise<RotateMcpOAuthSigningKeyResult<TSigningKeyRecord>> {
  const existingKeys = await args.listSigningKeys();
  const activeKey = existingKeys.find((key) => key.status === "active") ?? null;
  const rotatedAt = args.now ?? Date.now();
  if (activeKey !== null) {
    await args.retireSigningKey({
      keyId: activeKey.keyId,
      retiredAt: rotatedAt,
    });
  }

  const signingKey = await (args.createSigningKey?.() ?? createMcpOAuthSigningKeyRecord());
  await args.persistSigningKey(signingKey);

  return {
    activeKey,
    rotatedAt,
    signingKey,
  };
}
