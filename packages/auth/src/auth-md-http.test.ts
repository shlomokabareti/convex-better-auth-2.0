import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  AUTH_MD_CLAIM_GRANT,
  AUTH_MD_JWT_BEARER_GRANT,
  createAuthMdServiceAuthHttpServer,
} from "./auth-md";

describe("auth.md service_auth HTTP transport", () => {
  it("dispatches registration and both token grants with no-store responses", async () => {
    const calls: string[] = [];
    const server = createServer(calls);
    const registration = await server.handleHttpRequest(
      {},
      jsonRequest("/agent/identity", {
        type: "service_auth",
        login_hint: "owner@example.com",
      }),
    );
    assert.equal(registration.status, 201);
    assert.equal(registration.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls, ["authorize", "register:owner@example.com:chat:read,chat:write"]);

    const pending = await server.handleHttpRequest(
      {},
      formRequest("/oauth2/token", {
        grant_type: AUTH_MD_CLAIM_GRANT,
        claim_token: "pending",
      }),
    );
    assert.equal(pending.status, 400);
    assert.deepEqual(await pending.json(), {
      error: "authorization_pending",
      interval: 5,
    });

    const claimed = await server.handleHttpRequest(
      {},
      formRequest("/oauth2/token", {
        grant_type: AUTH_MD_CLAIM_GRANT,
        claim_token: "claimed",
      }),
    );
    assert.equal(claimed.status, 200);
    assert.equal((await claimed.json()).access_token, "access-1");

    const refreshed = await server.handleHttpRequest(
      {},
      formRequest("/oauth2/token", {
        grant_type: AUTH_MD_JWT_BEARER_GRANT,
        assertion: "assertion-1",
        resource: "https://chat.example.com/",
      }),
    );
    assert.equal(refreshed.status, 200);
    assert.equal((await refreshed.json()).access_token, "access-2");
  });

  it("fails closed on malformed registration but makes revocation opaque", async () => {
    const calls: string[] = [];
    const server = createServer(calls);
    const wrongType = await server.handleHttpRequest(
      {},
      jsonRequest("/agent/identity", { type: "anonymous" }),
    );
    assert.equal(wrongType.status, 400);
    assert.equal((await wrongType.json()).error, "unsupported_identity_type");

    const wrongContentType = await server.handleHttpRequest(
      {},
      new Request("https://auth.example.com/agent/identity", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "text/plain" },
      }),
    );
    assert.equal(wrongContentType.status, 400);
    assert.equal((await wrongContentType.json()).error, "invalid_request");

    const revoked = await server.handleHttpRequest(
      {},
      formRequest("/oauth2/revoke", { token: "invalid" }),
    );
    assert.equal(revoked.status, 200);
    assert.equal(await revoked.text(), "");
    assert.ok(calls.includes("revoke:invalid"));
  });
});

function createServer(calls: string[]) {
  return createAuthMdServiceAuthHttpServer({
    postClaimScopes: ["chat:write", "chat:read"],
    authority: {
      async authorizeRegistration() {
        calls.push("authorize");
      },
      async registerServiceAuth(_ctx, args) {
        calls.push(`register:${args.loginHint}:${args.scopes.join(",")}`);
        return {
          registration_id: "registration-1",
          registration_type: "service_auth",
          claim_url: "https://auth.example.com/agent/identity/claim",
          claim_token: "claim-1",
          claim_token_expires: "2027-01-15T08:05:00.000Z",
          post_claim_scopes: [...args.scopes],
          claim: {
            user_code: "123456",
            expires_in: 600,
            verification_uri: "https://auth.example.com/claim?claim_attempt_token=attempt-1",
            interval: 5,
          },
        };
      },
      async pollServiceAuthClaim(_ctx, args) {
        if (args.claimToken === "pending") {
          return { error: "authorization_pending" as const, interval: 5 };
        }
        return token("access-1", true);
      },
      async exchangeIdentityAssertion() {
        return token("access-2", false);
      },
      async revokeAccessToken(_ctx, args) {
        calls.push(`revoke:${args.accessToken}`);
        throw new Error("invalid or already revoked");
      },
    },
  });
}

function token(accessToken: string, assertion: boolean) {
  return {
    access_token: accessToken,
    token_type: "Bearer" as const,
    expires_in: 3600,
    scope: "chat:read chat:write",
    ...(assertion
      ? {
          identity_assertion: "assertion-1",
          assertion_expires: "2027-01-16T08:00:00.000Z",
        }
      : {}),
  };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://auth.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(path: string, body: Record<string, string>): Request {
  return new Request(`https://auth.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}
