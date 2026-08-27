import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { nativeEmailAndPassword } from "./provider.js";
import type {
  NativeAccountDoc,
  NativeEmailAndPasswordComponentHandle,
  NativeIdentityDoc,
  NativeUserDoc,
} from "./types.js";

async function dispatch(ref: unknown, args: Record<string, unknown>) {
  if (typeof ref === "function") {
    return await (ref as (args: Record<string, unknown>) => unknown)(args);
  }
  return undefined;
}

async function setupTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  process.env.JWT_PRIVATE_KEY = JSON.stringify(privateJwk);
  process.env.JWKS = JSON.stringify({ keys: [publicJwk] });
}

function exec(registered: unknown) {
  if ((typeof registered !== "object" && typeof registered !== "function") || registered === null) {
    throw new TypeError("expected an executable spec");
  }
  const handler = Reflect.get(registered, "_handler");
  if (typeof handler !== "function") {
    throw new TypeError("expected an executable handler");
  }
  return {
    handler: async (ctx: unknown, args: Record<string, unknown>) =>
      await Reflect.apply(handler, registered, [ctx, args]),
  };
}

describe("nativeEmailAndPassword", () => {
  beforeAll(setupTestKeys);

  it("signs up a new user", async () => {
    const provision = vi.fn(async () => ({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
    }));
    const createAccount = vi.fn(async () => "account_1");
    const createSession = vi.fn(async () => "session_1");

    const component = {
      identity: {
        provisionFromIdentity:
          provision as NativeEmailAndPasswordComponentHandle["identity"]["provisionFromIdentity"],
      },
      native: {
        accounts: {
          createAccount:
            createAccount as NativeEmailAndPasswordComponentHandle["native"]["accounts"]["createAccount"],
          getAccountBySubject: vi.fn(),
        },
        sessions: {
          createSession:
            createSession as NativeEmailAndPasswordComponentHandle["native"]["sessions"]["createSession"],
          revokeSession: vi.fn(),
        },
        identities: { getNativeIdentityByUser: vi.fn() },
        users: { getUserByEmail: vi.fn() },
      },
    } satisfies NativeEmailAndPasswordComponentHandle;

    const { signUp } = nativeEmailAndPassword(component);
    const { handler } = exec(signUp);
    const result = await handler(
      {
        runQuery: vi.fn((ref, args) => dispatch(ref, args)),
        runMutation: vi.fn((ref, args) => dispatch(ref, args)),
      },
      { email: "Shlomo@example.com ", password: "hunter2" },
    );

    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({
          provider: "password",
          issuer: "native",
          email: "shlomo@example.com",
        }),
      }),
    );
    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        provider: "password",
        issuer: "native",
      }),
    );
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1" }));

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: expect.any(String),
      sessionId: expect.any(String),
    });
  });

  it("signs in an existing user", async () => {
    const user: NativeUserDoc = {
      _id: "user_1",
      _creationTime: 0,
      email: "shlomo@example.com",
      emailVerified: false,
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    };
    const identity: NativeIdentityDoc = {
      _id: "identity_1",
      _creationTime: 0,
      identityId: "subject_1",
      userId: "user_1",
      provider: "password",
      issuer: "native",
      subject: "subject_1",
      tokenIdentifier: "subject_1",
      email: "shlomo@example.com",
      emailVerified: false,
      sessionId: null,
      createdAt: 0,
      updatedAt: 0,
    };

    const component = {
      identity: {
        provisionFromIdentity:
          vi.fn() as NativeEmailAndPasswordComponentHandle["identity"]["provisionFromIdentity"],
      },
      native: {
        accounts: {
          createAccount:
            vi.fn() as NativeEmailAndPasswordComponentHandle["native"]["accounts"]["createAccount"],
          getAccountBySubject: vi.fn(async (): Promise<NativeAccountDoc | null> => null),
        },
        sessions: {
          createSession: vi.fn(
            async (): Promise<string> => "session_1",
          ) as NativeEmailAndPasswordComponentHandle["native"]["sessions"]["createSession"],
          revokeSession:
            vi.fn() as NativeEmailAndPasswordComponentHandle["native"]["sessions"]["revokeSession"],
        },
        identities: {
          getNativeIdentityByUser: vi.fn(
            async (): Promise<NativeIdentityDoc | null> => identity,
          ) as NativeEmailAndPasswordComponentHandle["native"]["identities"]["getNativeIdentityByUser"],
        },
        users: {
          getUserByEmail: vi.fn(
            async (): Promise<NativeUserDoc | null> => user,
          ) as NativeEmailAndPasswordComponentHandle["native"]["users"]["getUserByEmail"],
        },
      },
    } satisfies NativeEmailAndPasswordComponentHandle;

    const { signIn } = nativeEmailAndPassword(component);
    const { handler } = exec(signIn);

    const passwordHash = (await import("./password.js")).hashPassword("hunter2");
    const account: NativeAccountDoc = {
      _id: "account_1",
      _creationTime: 0,
      userId: "user_1",
      provider: "password",
      issuer: "native",
      subject: "subject_1",
      credentialHash: passwordHash,
      createdAt: 0,
      updatedAt: 0,
    };
    component.native.accounts.getAccountBySubject = vi.fn(async () => account);

    const result = await handler(
      {
        runQuery: vi.fn((ref, args) => dispatch(ref, args)),
        runMutation: vi.fn((ref, args) => dispatch(ref, args)),
      },
      { email: "shlomo@example.com", password: "hunter2" },
    );

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: expect.any(String),
      sessionId: expect.any(String),
    });
  });
});
