import { query } from "../../component/_generated/server.js";
import { v } from "convex/values";
import { verifyToken } from "./jwt.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";
import { nativeAuthUserValidator, toNativeAuthUser } from "./types.js";

export type NativeAuthQueries = {
  verifySession: ReturnType<typeof query>;
};

export function nativeAuthQueries(
  component: NativeEmailAndPasswordComponentHandle,
): NativeAuthQueries {
  const verifySession = query({
    args: { token: v.string() },
    returns: v.object({
      user: v.optional(nativeAuthUserValidator),
      sessionId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
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
