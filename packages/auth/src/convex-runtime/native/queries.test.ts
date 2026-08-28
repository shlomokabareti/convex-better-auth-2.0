import { exportJWK, generateKeyPair } from "jose";
import type { HttpRouter } from "convex/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { addNativeAuthHttpRoutes } from "./http.js";
import { mintToken } from "./jwt.js";
import { nativeAuthQueries } from "./queries.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

function exec(registered: unknown) {
  if ((typeof registered !== "object" && typeof registered !== "function") || registered === null) {
    throw new TypeError("expected an executable spec");
  }
  const handler = Reflect.get(registered, "_handler");
  if (typeof handler !== "function") {
    throw new TypeError("expected an executable handler");
  }
  return {
    handler: async (ctx: unknown, args: Record<string, unknown>): Promise<unknown> =>
      await Reflect.apply(handler, registered, [ctx, args]),
  };
}

async function setupTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  process.env.JWT_PRIVATE_KEY = JSON.stringify(privateJwk);
  process.env.JWKS = JSON.stringify({ keys: [publicJwk] });
}

type MockComponent = NativeEmailAndPasswordComponentHandle & {
  native: {
    users: {
      getUserById: ReturnType<typeof vi.fn>;
    };
    sessions: {
      getSessionByToken: ReturnType<typeof vi.fn>;
    };
    codes: {
      getVerificationCodeByTokenHash: ReturnType<typeof vi.fn>;
    };
  };
};

function createMockComponent(): MockComponent {
  return {
    identity: {} as unknown as NativeEmailAndPasswordComponentHandle["identity"],
    native: {
      accounts: {} as unknown as NativeEmailAndPasswordComponentHandle["native"]["accounts"],
      users: {
        getUserByEmail: vi.fn(),
        getUserById: vi.fn(),
        markEmailVerified: vi.fn(),
      },
      identities: {
        getNativeIdentityByUser: vi.fn(),
        markEmailVerified: vi.fn(),
      } as unknown as NativeEmailAndPasswordComponentHandle["native"]["identities"],
      sessions: {
        createSession: vi.fn(),
        revokeSession: vi.fn(),
        listSessionsByUser: vi.fn(),
        getSessionByToken: vi.fn(),
        revokeSessionsForUser: vi.fn(),
      },
      codes: {
        createVerificationCode: vi.fn(),
        getVerificationCodeByTokenHash: vi.fn(),
        consumeVerificationCode: vi.fn(),
        revokeVerificationCodesForUser: vi.fn(),
      },
    },
  } as unknown as MockComponent;
}

function createContext() {
  return {
    runQuery: vi.fn(
      (ref: (args: Record<string, unknown>) => unknown, args: Record<string, unknown>) => ref(args),
    ),
    runMutation: vi.fn(
      (ref: (args: Record<string, unknown>) => unknown, args: Record<string, unknown>) => ref(args),
    ),
    db: {},
  };
}

describe("nativeAuthQueries", () => {
  beforeAll(setupTestKeys);

  it("verifySession returns the user and session id for a valid token", async () => {
    const component = createMockComponent();
    const user = {
      _id: "user_1",
      email: "shlomo@example.com",
      name: "Shlomo",
      emailVerified: true,
      createdAt: 0,
      updatedAt: 0,
    };
    component.native.users.getUserById.mockResolvedValue(user);
    component.native.sessions.getSessionByToken.mockResolvedValue({
      _id: "session_doc_1",
      sessionId: "session_1",
      userId: "user_1",
      token: "the-token",
      expiresAt: Date.now() + 60_000,
    });

    const { verifySession } = nativeAuthQueries(component);
    const { handler } = exec(verifySession);

    const token = await mintToken("user_1", "session_1");
    const result = (await handler(createContext(), { token })) as {
      user?: { id: string };
      sessionId?: string;
    };
    expect(result.user).toEqual({
      id: "user_1",
      email: "shlomo@example.com",
      name: "Shlomo",
      emailVerified: true,
      createdAt: 0,
      updatedAt: 0,
    });
    expect(result.sessionId).toBe("session_1");
  });

  it("verifySession returns an empty object for a missing session", async () => {
    const component = createMockComponent();
    component.native.sessions.getSessionByToken.mockResolvedValue(null);

    const { verifySession } = nativeAuthQueries(component);
    const { handler } = exec(verifySession);

    const token = await mintToken("user_1", "session_1");
    const result = await handler(createContext(), { token });
    expect(result).toEqual({});
  });

  it("verifySession returns an empty object for an invalid token", async () => {
    const component = createMockComponent();

    const { verifySession } = nativeAuthQueries(component);
    const { handler } = exec(verifySession);

    const result = await handler(createContext(), { token: "not-a-token" });
    expect(result).toEqual({});
  });
});

describe("addNativeAuthHttpRoutes", () => {
  beforeAll(setupTestKeys);

  it("serves /.well-known/jwks.json", async () => {
    const routes: {
      path: string;
      method: string;
      handler: (ctx: unknown, request: Request) => Promise<Response>;
    }[] = [];
    const http: HttpRouter = {
      route: (r) => {
        routes.push(r);
        return http;
      },
    } as unknown as HttpRouter;

    addNativeAuthHttpRoutes(http);
    const jwksRoute = routes.find((r) => r.path === "/.well-known/jwks.json" && r.method === "GET");
    expect(jwksRoute).toBeDefined();

    const response = await jwksRoute!.handler(
      createContext(),
      new Request("http://localhost/.well-known/jwks.json"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { keys: unknown[] };
    expect(body.keys).toBeInstanceOf(Array);
  });

  it("verifies an email and redirects when callbackURL is provided", async () => {
    const component = createMockComponent();
    const token = "verify-token";
    component.native.codes.getVerificationCodeByTokenHash.mockResolvedValue({
      _id: "code_1",
      tokenHash: "hashed",
      userId: "user_1",
      type: "email_verification",
      expiresAt: Date.now() + 60_000,
    });
    component.native.codes.consumeVerificationCode.mockResolvedValue({
      _id: "code_1",
      tokenHash: "hashed",
      userId: "user_1",
      type: "email_verification",
      expiresAt: Date.now() + 60_000,
    });
    const identity = {
      _id: "identity_1",
      userId: "user_1",
      provider: "password",
      issuer: "native",
      subject: "subject_1",
      emailVerified: false,
      createdAt: 0,
      updatedAt: 0,
    };
    component.native.identities.getNativeIdentityByUser.mockResolvedValue(identity);
    component.native.identities.markEmailVerified.mockResolvedValue(undefined);
    component.native.users.markEmailVerified.mockResolvedValue(undefined);

    const routes: {
      path: string;
      method: string;
      handler: (ctx: unknown, request: Request) => Promise<Response>;
    }[] = [];
    const http: HttpRouter = {
      route: (r) => {
        routes.push(r);
        return http;
      },
    } as unknown as HttpRouter;

    addNativeAuthHttpRoutes(http, component);
    const verifyRoute = routes.find(
      (r) => r.path === "/api/auth/verify-email" && r.method === "GET",
    );
    expect(verifyRoute).toBeDefined();

    const callbackURL = "https://app.example.com/welcome";
    const response = await verifyRoute!.handler(
      createContext(),
      new Request(
        "https://api.example.com/api/auth/verify-email?token=" +
          encodeURIComponent(token) +
          "&callbackURL=" +
          encodeURIComponent(callbackURL),
      ),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(callbackURL + "?token=" + token);
    expect(component.native.users.markEmailVerified).toHaveBeenCalledWith({
      userId: "user_1",
      emailVerified: true,
    });
  });

  it("redirects a valid reset token to the callback URL with the token", async () => {
    const component = createMockComponent();
    component.native.codes.getVerificationCodeByTokenHash.mockResolvedValue({
      _id: "code_1",
      tokenHash: "hashed",
      userId: "user_1",
      type: "password_reset",
      expiresAt: Date.now() + 60_000,
    });
    const routes: {
      path: string;
      method: string;
      handler: (ctx: unknown, request: Request) => Promise<Response>;
    }[] = [];
    const http: HttpRouter = {
      route: (r) => {
        routes.push(r);
        return http;
      },
    } as unknown as HttpRouter;

    addNativeAuthHttpRoutes(http, component);
    const resetRoute = routes.find(
      (r) => r.path === "/api/auth/reset-password/:token" && r.method === "GET",
    );
    expect(resetRoute).toBeDefined();

    const callbackURL = "https://app.example.com/reset";
    const response = await resetRoute!.handler(
      createContext(),
      new Request(
        "https://api.example.com/api/auth/reset-password/the-token?callbackURL=" +
          encodeURIComponent(callbackURL),
      ),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toBe(callbackURL + "?token=the-token");
  });

  it("redirects an invalid reset token to the callback URL with an error", async () => {
    const component = createMockComponent();
    component.native.codes.getVerificationCodeByTokenHash.mockResolvedValue(null);
    const routes: {
      path: string;
      method: string;
      handler: (ctx: unknown, request: Request) => Promise<Response>;
    }[] = [];
    const http: HttpRouter = {
      route: (r) => {
        routes.push(r);
        return http;
      },
    } as unknown as HttpRouter;

    addNativeAuthHttpRoutes(http, component);
    const resetRoute = routes.find(
      (r) => r.path === "/api/auth/reset-password/:token" && r.method === "GET",
    );
    expect(resetRoute).toBeDefined();

    const callbackURL = "https://app.example.com/reset";
    const response = await resetRoute!.handler(
      createContext(),
      new Request(
        "https://api.example.com/api/auth/reset-password/bad-token?callbackURL=" +
          encodeURIComponent(callbackURL),
      ),
    );
    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toBe(callbackURL + "?error=INVALID_TOKEN");
  });
});
