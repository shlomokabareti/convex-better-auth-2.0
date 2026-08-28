import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { addNativeOAuthHttpRoutes } from "./oauthHttp.js";
import {
  createGitHubProvider,
  type GitHubProviderConfig,
  type NativeOAuthProvider,
} from "./oauth.js";
import { nativeOAuth } from "./oauthActions.js";
import { handleCallback, handleSignIn, type NativeOAuthConfig } from "./oauthHandlers.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  mintOAuthState,
  verifyOAuthState,
} from "./oauthState.js";
import { verifyToken } from "./jwt.js";
import type { NativeOAuthComponentHandle } from "./types.js";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../../component/_generated/dataModel.js";

async function setupTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  process.env.JWT_PRIVATE_KEY = JSON.stringify(privateJwk);
  process.env.JWKS = JSON.stringify({ keys: [publicJwk] });
}

type MockComponent = {
  identity: { provisionFromIdentity: ReturnType<typeof vi.fn> };
  native: {
    accounts: {
      createAccount: ReturnType<typeof vi.fn>;
      getAccountBySubject: ReturnType<typeof vi.fn>;
    };
    sessions: { createSession: ReturnType<typeof vi.fn> };
  };
};

function createMockComponent(): MockComponent {
  return {
    identity: {
      provisionFromIdentity: vi.fn(),
    },
    native: {
      accounts: {
        createAccount: vi.fn(),
        getAccountBySubject: vi.fn(),
      },
      sessions: {
        createSession: vi.fn(),
      },
    },
  } as MockComponent;
}

function dispatch(ref: unknown, args: Record<string, unknown>) {
  if (typeof ref === "function") {
    return (ref as (args: Record<string, unknown>) => unknown)(args);
  }
  return undefined;
}

function createContext() {
  return {
    runQuery: vi.fn((ref: unknown, args: Record<string, unknown>) => dispatch(ref, args)),
    runMutation: vi.fn((ref: unknown, args: Record<string, unknown>) => dispatch(ref, args)),
    runAction: vi.fn(),
  };
}

function createMockFetch(): {
  fetch: ReturnType<typeof vi.fn>;
  responses: Map<string, { status?: number; body: unknown; headers?: Record<string, string> }>;
} {
  const responses = new Map<
    string,
    { status?: number; body: unknown; headers?: Record<string, string> }
  >();
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    const key = url;
    const response = responses.get(key);
    if (!response) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: response.headers,
    });
  });
  return { fetch, responses };
}

function createGitHubConfig(overrides: Partial<GitHubProviderConfig> = {}): GitHubProviderConfig {
  const { fetch } = createMockFetch();
  return {
    clientId: "client-id",
    clientSecret: "client-secret",
    fetchImpl: fetch as unknown as typeof globalThis.fetch,
    ...overrides,
  };
}

function createOAuthConfig(overrides: Partial<NativeOAuthConfig> = {}): NativeOAuthConfig {
  return {
    github: createGitHubConfig(),
    redirectURI: "https://app.example.com/api/auth/callback/github",
    sessionTtlMs: 60_000,
    ...overrides,
  };
}

function setupGitHubResponses(
  provider: NativeOAuthProvider,
  responses: ReturnType<typeof createMockFetch>["responses"],
) {
  responses.set("https://github.com/login/oauth/access_token", {
    body: { access_token: "github-access-token", token_type: "bearer" },
  });
  responses.set("https://api.github.com/user", {
    body: {
      id: 12345,
      login: "octocat",
      name: "The Octocat",
      email: null,
      avatar_url: "https://avatar",
    },
  });
  responses.set("https://api.github.com/user/emails", {
    body: [
      { email: "octocat@example.com", primary: true, verified: true, visibility: "public" },
      { email: "other@example.com", primary: false, verified: false, visibility: "private" },
    ],
  });
}

describe("OAuth state and PKCE", () => {
  beforeAll(setupTestKeys);

  it("generates a verifier and a matching S256 challenge", async () => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toEqual(verifier);
  });

  it("round-trips a signed state token", async () => {
    const state = await mintOAuthState({
      provider: "github",
      codeVerifier: "verifier",
      callbackURL: "https://app.example.com/callback",
    });
    const payload = await verifyOAuthState(state);
    expect(payload.provider).toBe("github");
    expect(payload.codeVerifier).toBe("verifier");
    expect(payload.callbackURL).toBe("https://app.example.com/callback");
  });

  it("rejects an expired or tampered state token", async () => {
    const state = await mintOAuthState({ provider: "github", codeVerifier: "verifier" });
    await expect(verifyOAuthState(`${state}x`)).rejects.toThrow();
  });
});

describe("GitHub provider", () => {
  beforeAll(setupTestKeys);

  it("creates an authorization URL with client_id, PKCE, and state", () => {
    const config = createGitHubConfig();
    const provider = createGitHubProvider(config);
    const url = provider.createAuthorizationURL({
      state: "state-token",
      codeChallenge: "challenge",
      redirectURI: "https://app.example.com/api/auth/callback/github",
    });
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("read:user");
  });

  it("exchanges a code for an access token", async () => {
    const config = createGitHubConfig();
    const { fetch, responses } = createMockFetch();
    config.fetchImpl = fetch as unknown as typeof globalThis.fetch;
    const provider = createGitHubProvider(config);
    responses.set("https://github.com/login/oauth/access_token", {
      body: { access_token: "token-123", token_type: "bearer" },
    });

    const token = await provider.exchangeAuthorizationCode({
      code: "code-123",
      codeVerifier: "verifier",
      redirectURI: "https://app.example.com/api/auth/callback/github",
    });

    expect(token.accessToken).toBe("token-123");
    expect(fetch).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
  });

  it("fetches user info and falls back to primary email", async () => {
    const config = createGitHubConfig();
    const { fetch, responses } = createMockFetch();
    config.fetchImpl = fetch as unknown as typeof globalThis.fetch;
    const provider = createGitHubProvider(config);
    setupGitHubResponses(provider, responses);

    const { user } = await provider.getUserInfo({ accessToken: "github-access-token" });

    expect(user.id).toBe("12345");
    expect(user.name).toBe("The Octocat");
    expect(user.email).toBe("octocat@example.com");
    expect(user.image).toBe("https://avatar");
    expect(user.emailVerified).toBe(true);
  });
});

describe("OAuth handlers", () => {
  beforeAll(setupTestKeys);

  it("handleSignIn returns a GitHub authorization URL", async () => {
    const config = createOAuthConfig();
    process.env.CONVEX_SITE_URL = "https://app.example.com";

    const { url } = await handleSignIn(config, { provider: "github" });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("client-id");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBeTruthy();
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/callback/github",
    );
  });

  it("handleCallback provisions a new user and creates a session", async () => {
    const config = createOAuthConfig();
    const component = createMockComponent();
    const { fetch, responses } = createMockFetch();
    config.github.fetchImpl = fetch as unknown as typeof globalThis.fetch;
    setupGitHubResponses(createGitHubProvider(config.github), responses);

    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
    });
    component.native.accounts.getAccountBySubject.mockResolvedValue(null);
    component.native.sessions.createSession.mockResolvedValue("session_doc_1");

    const { url } = await handleSignIn(config, { provider: "github" });
    const state = new URL(url).searchParams.get("state")!;

    const result = await handleCallback(
      createContext() as unknown as GenericActionCtx<DataModel>,
      component as unknown as NativeOAuthComponentHandle,
      config,
      { provider: "github", code: "code-123", state },
    );

    expect(result.createdUser).toBe(true);
    expect(result.userId).toBe("user_1");
    expect(result.identityId).toBe("identity_1");
    expect(result.token).toBeTruthy();
    expect(result.redirectUrl).toBe("/");

    const payload = await verifyToken(result.token);
    expect(payload.sub).toBe("user_1");
    expect(payload.sessionId).toBe(result.sessionId);

    expect(component.identity.provisionFromIdentity).toHaveBeenCalledWith({
      identity: expect.objectContaining({
        provider: "github",
        issuer: "https://github.com/login/oauth",
        subject: "12345",
        identityId: "https://github.com/login/oauth:12345",
        tokenIdentifier: "https://github.com/login/oauth:12345",
      }),
      user: expect.objectContaining({
        name: "The Octocat",
        email: "octocat@example.com",
        image: "https://avatar",
        emailVerified: true,
      }),
    });
    expect(component.native.sessions.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        token: result.token,
      }),
    );
  });

  it("handleCallback redirects to newUserURL for new users", async () => {
    const config = createOAuthConfig();
    const component = createMockComponent();
    const { fetch, responses } = createMockFetch();
    config.github.fetchImpl = fetch as unknown as typeof globalThis.fetch;
    setupGitHubResponses(createGitHubProvider(config.github), responses);

    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
    });
    component.native.accounts.getAccountBySubject.mockResolvedValue(null);
    component.native.sessions.createSession.mockResolvedValue("session_doc_1");

    const { url } = await handleSignIn(config, {
      provider: "github",
      callbackURL: "https://app.example.com/home",
      newUserURL: "https://app.example.com/welcome",
    });
    const state = new URL(url).searchParams.get("state")!;

    const result = await handleCallback(
      createContext() as unknown as GenericActionCtx<DataModel>,
      component as unknown as NativeOAuthComponentHandle,
      config,
      { provider: "github", code: "code-123", state },
    );

    expect(result.redirectUrl).toBe("https://app.example.com/welcome");
  });
});

describe("nativeOAuth actions", () => {
  beforeAll(setupTestKeys);

  it("returns an authorization URL from the signIn action", async () => {
    const config = createOAuthConfig();
    const component = createMockComponent();
    process.env.CONVEX_SITE_URL = "https://app.example.com";

    const actions = nativeOAuth(component as unknown as NativeOAuthComponentHandle, config);
    const registered = (
      actions.signIn as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => unknown;
      }
    )._handler;
    const { url } = (await registered(createContext(), { provider: "github" })) as {
      url: string;
    };

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("state")).toBeTruthy();
  });
});

describe("addNativeOAuthHttpRoutes", () => {
  beforeAll(setupTestKeys);

  it("registers signin and callback routes and handles a full flow", async () => {
    const config = createOAuthConfig();
    const component = createMockComponent();
    const { fetch, responses } = createMockFetch();
    config.github.fetchImpl = fetch as unknown as typeof globalThis.fetch;
    setupGitHubResponses(createGitHubProvider(config.github), responses);

    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
    });
    component.native.accounts.getAccountBySubject.mockResolvedValue(null);
    component.native.sessions.createSession.mockResolvedValue("session_doc_1");

    const routes: {
      path: string;
      method: string;
      handler: (ctx: unknown, request: Request) => Promise<Response>;
    }[] = [];
    const http = {
      route: (r: {
        path: string;
        method: string;
        handler: (ctx: unknown, request: Request) => Promise<Response>;
      }) => routes.push(r),
    };

    addNativeOAuthHttpRoutes(http as unknown as import("convex/server").HttpRouter, {
      component: component as unknown as NativeOAuthComponentHandle,
      oauth: config,
    });

    expect(routes).toHaveLength(2);
    const signinRoute = routes.find((r) => r.path === "/api/auth/signin/:provider")!;
    const callbackRoute = routes.find((r) => r.path === "/api/auth/callback/:provider")!;

    const signinResponse = await signinRoute.handler(
      createContext(),
      new Request(
        "https://app.example.com/api/auth/signin/github?redirectTo=https://app.example.com/home",
      ),
    );
    expect(signinResponse.status).toBe(302);
    const location = signinResponse.headers.get("Location")!;
    const authUrl = new URL(location);
    const state = authUrl.searchParams.get("state")!;
    const code = "code-123";

    const callbackResponse = await callbackRoute.handler(
      createContext() as unknown as GenericActionCtx<DataModel>,
      new Request(`https://app.example.com/api/auth/callback/github?code=${code}&state=${state}`),
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get("Location")).toBe("https://app.example.com/home");
    expect(callbackResponse.headers.get("Set-Cookie")).toMatch(/convex-auth-token=/);
  });
});
