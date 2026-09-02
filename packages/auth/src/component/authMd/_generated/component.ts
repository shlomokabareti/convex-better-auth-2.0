/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    authMd: {
      completeServiceAuthClaim: FunctionReference<
        "mutation",
        "internal",
        {
          claimViewTokenHash: string;
          organizationId: string;
          userCodeHash: string;
          userId: string;
        },
        | { ok: true; status: "claimed" }
        | { ok: false; reason: "invalid_claim" },
        Name
      >;
      consumeServiceAuthAssertion: FunctionReference<
        "mutation",
        "internal",
        { assertionId: string; credentialExpiresInSeconds: number },
        {
          credentialId: string;
          expiresAt: number;
          issuedAt: number;
          organizationId: string;
          registrationId: string;
          resource: string;
          scopes: Array<string>;
          userId: string;
        },
        Name
      >;
      introspectServiceAuthCredential: FunctionReference<
        "query",
        "internal",
        { credentialId: string },
        | { active: false }
        | {
            active: true;
            credentialId: string;
            expiresAt: number;
            organizationId: string;
            registrationId: string;
            resource: string;
            scopes: Array<string>;
            userId: string;
          },
        Name
      >;
      pollServiceAuthClaim: FunctionReference<
        "mutation",
        "internal",
        { claimTokenHash: string },
        | { interval: number; status: "authorization_pending" }
        | { interval: number; status: "slow_down" }
        | { status: "expired_token" }
        | { status: "access_denied" }
        | {
            assertionId: string;
            expiresAt: number;
            issuedAt: number;
            organizationId: string;
            registrationId: string;
            resource: string;
            scopes: Array<string>;
            status: "claimed";
            userId: string;
          },
        Name
      >;
      refreshServiceAuthCredential: FunctionReference<
        "mutation",
        "internal",
        { credentialExpiresInSeconds: number; credentialId: string },
        {
          credentialId: string;
          expiresAt: number;
          issuedAt: number;
          organizationId: string;
          registrationId: string;
          resource: string;
          scopes: Array<string>;
          userId: string;
        },
        Name
      >;
      registerServiceAuth: FunctionReference<
        "mutation",
        "internal",
        {
          claimTokenHash: string;
          claimViewTokenHash: string;
          expiresAt: number;
          loginHintHash: string;
          pollIntervalSeconds: number;
          resource: string;
          scopes: Array<string>;
          userCodeExpiresAt: number;
          userCodeHash: string;
        },
        { registrationId: string },
        Name
      >;
      revokeServiceAuthCredentialAsHolder: FunctionReference<
        "mutation",
        "internal",
        { credentialId: string },
        { ok: true },
        Name
      >;
      revokeServiceAuthRegistration: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; registrationId: string },
        { ok: true },
        Name
      >;
    };
  };
