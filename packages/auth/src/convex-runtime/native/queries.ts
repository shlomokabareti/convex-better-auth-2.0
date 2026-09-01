import { query, type QueryCtx } from "../../component/_generated/server.js";
import { v } from "convex/values";
import { verifyToken } from "./jwt.js";
import type { NativeEmailAndPasswordComponentHandle, NativeSessionDoc } from "./types.js";
import { nativeAuthUserValidator, toNativeAuthUser } from "./types.js";

export type NativeAuthQueries = {
  verifySession: ReturnType<typeof query>;
};

export function nativeAuthQueries(
  component: NativeEmailAndPasswordComponentHandle,
): NativeAuthQueries {
  const verifySession = query({
    args: {
      token: v.optional(v.string()),
      sessionId: v.optional(v.string()),
    },
    returns: v.object({
      user: v.optional(nativeAuthUserValidator),
      sessionId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const userId = identity.subject;
        const session = await resolveSessionFromAuth(ctx, component, userId, args.sessionId);
        if (!session) {
          return {};
        }
        const user = await ctx.runQuery(component.native.users.getUserById, { userId });
        if (!user) {
          return {};
        }
        return { user: toNativeAuthUser(user), sessionId: session.sessionId };
      }

      if (!args.token) {
        return {};
      }

      let payload;
      try {
        payload = await verifyToken(args.token);
      } catch {
        return {};
      }
      const userId = payload.sub;
      const sessionId = payload.sessionId;
      if (typeof userId !== "string" || typeof sessionId !== "string") {
        return {};
      }

      const session = await ctx.runQuery(component.native.sessions.getSessionByToken, {
        token: args.token,
      });
      if (!session || session.sessionId !== sessionId || (session.expiresAt ?? 0) < Date.now()) {
        return {};
      }

      const user = await ctx.runQuery(component.native.users.getUserById, { userId });
      if (!user) {
        return {};
      }

      return { user: toNativeAuthUser(user), sessionId };
    },
  });

  return { verifySession };
}

async function resolveSessionFromAuth(
  ctx: QueryCtx,
  component: NativeEmailAndPasswordComponentHandle,
  userId: string,
  sessionId?: string,
) {
  if (sessionId) {
    const session = await ctx.runQuery(component.native.sessions.getSessionBySessionId, {
      sessionId,
    });
    if (
      session &&
      session.userId === userId &&
      (session.expiresAt ?? 0) >= Date.now() &&
      session.revokedAt === undefined
    ) {
      return session;
    }
    return null;
  }

  const sessions = await ctx.runQuery(component.native.sessions.listSessionsByUser, {
    userId,
  });
  const now = Date.now();
  const active = sessions.find(
    (s: NativeSessionDoc) => (s.expiresAt ?? 0) >= now && s.revokedAt === undefined,
  );
  return active ?? null;
}
