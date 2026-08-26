import type { GenericDataModel } from "convex/server";

import type { BetterAuthConvexRuntime } from "./convex";

/**
 * Increment 6a — the test-session handler.
 *
 * A secret-guarded HTTP handler the consumer mounts. It forwards a SERVER-SIDE
 * sign-in to the existing Better-Auth handler and returns the session, so a test
 * (or any trusted automation) gets a real session WITHOUT driving the UI form.
 * Captcha in this package is scoped to sign-up / password-reset, never sign-in,
 * so the forwarded sign-in has no captcha friction.
 *
 * Risk is BOUNDED: it requires `email` + `password` + the shared secret — a
 * caller holding email+password could already sign in; this only removes the
 * form. The password-LESS path (impersonation) is Increment 6b and needs
 * principal authority + an adversarial review, NOT a shared secret.
 *
 * FAIL-CLOSED contract (in order):
 *   1. flag off OR no secret configured        → 404 (the endpoint does not exist)
 *   2. presented secret ≠ configured (constant-time) → 403
 *   3. body missing email/password             → 400
 *   4. else forward `POST {basePath}/sign-in/email` to `createAuth(ctx).handler`
 *
 * Both the flag and the secret are server-only and OFF by default. Enable per
 * deployment (test/dev); do NOT enable in prod unless a deployment explicitly
 * opts in.
 */
export type CreateTestSessionHandlerConfig<DataModel extends GenericDataModel> =
  {
    /** The runtime's `createAuth` — yields the Better-Auth instance whose `.handler` we forward to. */
    createAuth: BetterAuthConvexRuntime<DataModel>["createAuth"];
    /** Master switch. Return `false` (the default posture) and the endpoint is a 404. */
    isEnabled: () => boolean;
    /** Server-only shared secret. Absent/empty ⇒ the endpoint is a 404. */
    getSecret: () => string | undefined;
    /** Better-Auth base path. Default `"/api/auth"`. */
    basePath?: string;
    /** Header the caller presents the secret in. Default `"x-convex-auth-test-secret"`. */
    secretHeaderName?: string;
  };

export function createTestSessionHandler<TContext>(
  config: Omit<
    CreateTestSessionHandlerConfig<GenericDataModel>,
    "createAuth"
  > & {
    createAuth: (ctx: TContext) => {
      handler(request: Request): Promise<Response>;
    };
  }
): (ctx: TContext, request: Request) => Promise<Response> {
  const basePath = (config.basePath ?? "/api/auth").replace(/\/$/, "");
  const secretHeaderName = config.secretHeaderName ?? "x-convex-auth-test-secret";

  return async (ctx, request) => {
    const secret = config.getSecret();
    if (!config.isEnabled() || secret === undefined || secret.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    // Coalesce a missing header to "" and ALWAYS run the constant-time compare —
    // short-circuiting on `null` would make "header absent" distinguishable from
    // "header present but wrong" by response latency.
    const presented = request.headers.get(secretHeaderName) ?? "";
    if (!constantTimeEqual(presented, secret)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      typeof Reflect.get(body, "email") !== "string" ||
      typeof Reflect.get(body, "password") !== "string"
    ) {
      return new Response("email and password are required", { status: 400 });
    }
    const email = Reflect.get(body, "email");
    const password = Reflect.get(body, "password");

    const signInRequest = new Request(
      new URL(`${basePath}/sign-in/email`, request.url),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );

    return await config.createAuth(ctx).handler(signInRequest);
  };
}

/**
 * XOR constant-time compare. Length mismatch is folded into the accumulator
 * (not an early return) so the secret's LENGTH is not leaked via timing; the
 * loop runs over the longer of the two regardless of where they diverge.
 */
function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
