import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";
import { nativeMagicLink, type NativeMagicLinkConfig } from "./magicLink.js";

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

function dispatch(ref: unknown, args: Record<string, unknown>) {
  if (typeof ref === "function") {
    return (ref as (args: Record<string, unknown>) => unknown)(args);
  }
  if (typeof ref === "object" && ref !== null) {
    const handler = Reflect.get(ref, "_handler");
    if (typeof handler === "function") {
      return Reflect.apply(handler, ref, [{}, args]);
    }
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

type Mockify<T> = {
  [K in keyof T]: T[K] extends FunctionReference<infer _Type, infer _Visibility, infer Args, infer Return, infer _ComponentPath>
    ? ReturnType<typeof vi.fn> extends (args: Args) => Promise<Awaited<Return>>
      ? ReturnType<typeof vi.fn>
      : ReturnType<typeof vi.fn>
    : T[K] extends Record<string, unknown>
      ? Mockify<T[K]>
      : T[K];
};

function createMockComponent(): Mockify<NativeEmailAndPasswordComponentHandle> {
  return {
    identity: {
      provisionFromIdentity: vi.fn(),
      getUserAndAccount: vi.fn(),
      verifyEmail: vi.fn(),
      resetPassword: vi.fn(),
    },
    native: {
      accounts: {
        createAccount: vi.fn(),
        updateCredentialHash: vi.fn(),
        getAccountBySubject: vi.fn(),
      },
      sessions: {
        createSession: vi.fn(),
        createSessionAndRefreshToken: vi.fn(),
        revokeSession: vi.fn(),
        listSessionsByUser: vi.fn(),
        getSessionByToken: vi.fn(),
        getSessionBySessionId: vi.fn(),
        revokeSessionsForUser: vi.fn(),
        rotateSession: vi.fn(),
      },
      refreshTokens: {
        createRefreshToken: vi.fn(),
        getRefreshTokenByTokenHash: vi.fn(),
        consumeRefreshToken: vi.fn(),
        revokeRefreshTokensForSession: vi.fn(),
        revokeRefreshTokensForUser: vi.fn(),
      },
      identities: {
        getNativeIdentityByUser: vi.fn(),
        markEmailVerified: vi.fn(),
      },
      users: {
        getUserByEmail: vi.fn(),
        getUserById: vi.fn(),
        markEmailVerified: vi.fn(),
        setTwoFactor: vi.fn(),
        consumeBackupCode: vi.fn(),
      },
      codes: {
        createVerificationCode: vi.fn(),
        getVerificationCodeByTokenHash: vi.fn(),
        consumeVerificationCode: vi.fn(),
        revokeVerificationCodesForUser: vi.fn(),
      },
      verifiers: {
        createVerifier: vi.fn(),
        getVerifierByVerifierId: vi.fn(),
        consumeVerifier: vi.fn(),
      },
    },
  } as unknown as Mockify<NativeEmailAndPasswordComponentHandle>;
}

function createConfig(overrides: Partial<NativeMagicLinkConfig> = {}): NativeMagicLinkConfig {
  return {
    sendMagicLink: vi.fn().mockResolvedValue("email_1"),
    ...overrides,
  };
}

describe("nativeMagicLink", () => {
  beforeAll(() => {
    process.env.CONVEX_SITE_URL = "https://test.convex.site";
  });

  it("signInMagicLink creates a verifier and sends a magic link", async () => {
    const component = createMockComponent();
    const sendMagicLink = vi.fn().mockResolvedValue("email_1");
    const { signInMagicLink } = nativeMagicLink(component as unknown as NativeEmailAndPasswordComponentHandle, {
      sendMagicLink,
    });
    const { handler } = exec(signInMagicLink);

    const ctx = createContext();
    const result = await handler(ctx, {
      email: "Shlomo@example.com ",
      callbackURL: "/dashboard",
    });

    expect(result).toMatchObject({ status: true });

    const createCall = (component as any).native.verifiers.createVerifier.mock.calls[0]?.[0];
    expect(createCall).toMatchObject({
      type: "magic-link",
    });
    expect(typeof createCall.verifierId).toBe("string");
    expect(typeof createCall.expiresAt).toBe("number");

    const metadata = JSON.parse(createCall.metadata);
    expect(metadata.email).toBe("shlomo@example.com");

    expect(sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "shlomo@example.com",
        url: expect.stringMatching(
          /https:\/\/test\.convex\.site\/magic-link\/verify\?token=[a-f0-9]+&callbackURL=%2Fdashboard$/,
        ),
      }),
    );
  });

  it("rejects an invalid email", async () => {
    const component = createMockComponent();
    const { signInMagicLink } = nativeMagicLink(component as unknown as NativeEmailAndPasswordComponentHandle, createConfig());
    const { handler } = exec(signInMagicLink);

    const ctx = createContext();
    await expect(handler(ctx, { email: "not-an-email" })).rejects.toThrow("Invalid email");
    expect((component as any).native.verifiers.createVerifier).not.toHaveBeenCalled();
  });

  it("rejects when disabled", async () => {
    const component = createMockComponent();
    const { signInMagicLink } = nativeMagicLink(component as unknown as NativeEmailAndPasswordComponentHandle, {
      ...createConfig(),
      enabled: false,
    });
    const { handler } = exec(signInMagicLink);

    const ctx = createContext();
    await expect(handler(ctx, { email: "shlomo@example.com" })).rejects.toThrow(
      "Magic link authentication is disabled",
    );
  });
});
