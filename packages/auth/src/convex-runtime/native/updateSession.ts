import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { mintToken } from "./jwt.js";
import { generateVerificationToken, hashToken } from "./tokens.js";
import type {
  NativeAuthSession,
  NativeEmailAndPasswordComponentHandle,
} from "./types.js";
import { toNativeAuthUser } from "./types.js";

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function handleUpdateSession<DataModel extends GenericDataModel>(
  ctx: GenericActionCtx<DataModel>,
  component: NativeEmailAndPasswordComponentHandle,
  refreshToken: string,
): Promise<NativeAuthSession> {
  const now = Date.now();
  const tokenHash = hashToken(refreshToken);

  const refresh = await ctx.runMutation(component.native.refreshTokens.consumeRefreshToken, {
    tokenHash,
  });
  if (!refresh) {
    throw new Error("Invalid refresh token");
  }

  const session = await ctx.runQuery(component.native.sessions.getSessionBySessionId, {
    sessionId: refresh.sessionId,
  });
  if (!session || session.revokedAt !== undefined || session.expiresAt <= now) {
    throw new Error("Invalid refresh token");
  }

  const user = await ctx.runQuery(component.native.users.getUserById, { userId: refresh.userId });
  if (!user) {
    throw new Error("User not found");
  }

  const identity = await ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
    userId: refresh.userId,
    provider: "password",
    issuer: "native",
  });
  if (!identity) {
    throw new Error("Identity not found");
  }

  await ctx.runMutation(component.native.sessions.revokeSession, { sessionId: refresh.sessionId });

  const sessionId = crypto.randomUUID();
  const newRefreshToken = generateVerificationToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const sessionTtlMs = DEFAULT_SESSION_TTL_MS;
  const refreshTokenTtlMs = DEFAULT_REFRESH_TOKEN_TTL_MS;
  const expiresAt = now + sessionTtlMs;

  const token = await mintToken(
    refresh.userId,
    sessionId,
    { identityId: identity._id },
    { expiresInSeconds: Math.floor(sessionTtlMs / 1000) },
  );

  await ctx.runMutation(component.native.sessions.createSession, {
    sessionId,
    userId: refresh.userId,
    token,
    expiresAt,
  });

  await ctx.runMutation(component.native.refreshTokens.createRefreshToken, {
    tokenHash: newRefreshTokenHash,
    sessionId,
    userId: refresh.userId,
    expiresAt: now + refreshTokenTtlMs,
  });

  return {
    token,
    refreshToken: newRefreshToken,
    user: toNativeAuthUser(user),
    userId: user._id,
    identityId: identity._id,
    sessionId,
  };
}
