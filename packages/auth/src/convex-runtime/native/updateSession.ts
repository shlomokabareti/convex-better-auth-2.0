import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { mintToken } from "./jwt.js";
import { generateVerificationToken, hashToken } from "./tokens.js";
import type { NativeAuthSession, NativeEmailAndPasswordComponentHandle } from "./types.js";
import { toNativeAuthUser } from "./types.js";

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function handleUpdateSession<DataModel extends GenericDataModel>(
  ctx: GenericActionCtx<DataModel>,
  component: NativeEmailAndPasswordComponentHandle,
  refreshToken: string,
): Promise<NativeAuthSession> {
  const now = Date.now();
  const oldRefreshTokenHash = hashToken(refreshToken);

  const refresh = await ctx.runQuery(component.native.refreshTokens.getRefreshTokenByTokenHash, {
    tokenHash: oldRefreshTokenHash,
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

  const [user, identity] = await Promise.all([
    ctx.runQuery(component.native.users.getUserById, { userId: refresh.userId }),
    ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
      userId: refresh.userId,
      provider: "password",
      issuer: "native",
    }),
  ]);
  if (!user) {
    throw new Error("User not found");
  }
  if (!identity) {
    throw new Error("Identity not found");
  }

  const sessionId = crypto.randomUUID();
  const newRefreshToken = generateVerificationToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const sessionTtlMs = DEFAULT_SESSION_TTL_MS;
  const refreshTokenTtlMs = DEFAULT_REFRESH_TOKEN_TTL_MS;
  const expiresAt = now + sessionTtlMs;

  const token = await mintToken(
    user._id,
    sessionId,
    { identityId: identity._id },
    { expiresInSeconds: Math.floor(sessionTtlMs / 1000) },
  );

  const result = await ctx.runMutation(component.native.sessions.rotateSession, {
    oldRefreshTokenHash,
    newSessionId: sessionId,
    newSessionToken: token,
    newSessionExpiresAt: expiresAt,
    newRefreshTokenHash,
    newRefreshTokenExpiresAt: now + refreshTokenTtlMs,
    provider: "password",
    issuer: "native",
  });

  if (!result) {
    throw new Error("Invalid refresh token");
  }

  return {
    token,
    refreshToken: newRefreshToken,
    user: toNativeAuthUser(result.user),
    userId: result.user._id,
    identityId: result.identityId,
    sessionId,
  };
}
