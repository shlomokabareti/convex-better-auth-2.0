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
  };
};

function createMockComponent(): MockComponent {
  return {
    identity: {} as any,
    native: {
      accounts: {} as any,
      users: {
        getUserByEmail: vi.fn(),
        getUserById: vi.fn(),
        markEmailVerified: vi.fn(),
      },
      identities: {} as any,
      sessions: {
        createSession: vi.fn(),
        revokeSession: vi.fn(),
        listSessionsByUser: vi.fn(),
        getSessionByToken: vi.fn(),
        revokeSessionsForUser: vi.fn(),
      },
      codes: {} as any,
    },
  } as unknown as MockComponent;
}

function createContext() {
  return {
    runQuery: vi.fn((ref: any, args: any) => ref(args)),
    runMutation: vi.fn(),
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
    } as any;

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
});
