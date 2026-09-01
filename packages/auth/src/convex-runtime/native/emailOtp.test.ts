import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";
import { nativeEmailOtp, type NativeEmailOtpConfig } from "./emailOtp.js";

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
  [K in keyof T]: T[K] extends FunctionReference<
    infer _Type,
    infer _Visibility,
    infer Args,
    infer Return,
    infer _ComponentPath
  >
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

function createConfig(overrides: Partial<NativeEmailOtpConfig> = {}): NativeEmailOtpConfig {
  return {
    sendVerificationOTP: vi.fn().mockResolvedValue("email_1"),
    ...overrides,
  };
}

describe("nativeEmailOtp", () => {
  beforeAll(() => {
    process.env.CONVEX_SITE_URL = "https://test.convex.site";
  });

  it("signInEmailOtp creates a verifier and sends a 6-digit OTP", async () => {
    const component = createMockComponent();
    const sendVerificationOTP = vi.fn().mockResolvedValue("email_1");
    const { signInEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      { sendVerificationOTP },
    );
    const { handler } = exec(signInEmailOtp);

    const ctx = createContext();
    const result = await handler(ctx, {
      email: "Shlomo@example.com ",
      type: "sign-in",
    });

    expect(result).toMatchObject({ status: "queued" });

    const createCall = (component as any).native.verifiers.createVerifier.mock.calls[0]?.[0];
    expect(createCall).toMatchObject({
      type: "email-otp",
    });
    expect(typeof createCall.verifierId).toBe("string");
    expect(typeof createCall.expiresAt).toBe("number");

    const metadata = JSON.parse(createCall.metadata);
    expect(metadata.email).toBe("shlomo@example.com");

    expect(sendVerificationOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "shlomo@example.com",
        type: "sign-in",
      }),
    );
    expect(sendVerificationOTP.mock.calls[0][0].otp).toMatch(/^\d{6}$/);
  });

  it("rejects an invalid email", async () => {
    const component = createMockComponent();
    const { signInEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      createConfig(),
    );
    const { handler } = exec(signInEmailOtp);

    const ctx = createContext();
    await expect(handler(ctx, { email: "not-an-email" })).rejects.toThrow("Invalid email");
    expect((component as any).native.verifiers.createVerifier).not.toHaveBeenCalled();
  });

  it("rejects when disabled", async () => {
    const component = createMockComponent();
    const { signInEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      { ...createConfig(), enabled: false },
    );
    const { handler } = exec(signInEmailOtp);

    const ctx = createContext();
    await expect(handler(ctx, { email: "shlomo@example.com" })).rejects.toThrow(
      "Email OTP authentication is disabled",
    );
  });

  it("verifyEmailOtp creates a user and returns a session", async () => {
    const component = createMockComponent();
    const sendVerificationOTP = vi.fn().mockResolvedValue("email_1");
    const { signInEmailOtp, verifyEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      { sendVerificationOTP },
    );

    const ctx = createContext();
    await exec(signInEmailOtp).handler(ctx, { email: "Shlomo@example.com ", type: "sign-in" });

    const otp = sendVerificationOTP.mock.calls[0][0].otp;

    component.native.verifiers.consumeVerifier = vi.fn().mockResolvedValue({
      _id: "verifier_1",
      verifierId: expect.any(String),
      type: "email-otp",
      metadata: JSON.stringify({ email: "shlomo@example.com", name: "Shlomo" }),
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    component.native.users.getUserByEmail = vi.fn().mockResolvedValue(null);
    component.identity.provisionFromIdentity = vi.fn().mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
      token: "jwt_1",
      sessionId: "session_1",
      user: {
        _id: "user_1",
        email: "shlomo@example.com",
        name: "Shlomo",
        emailVerified: true,
        twoFactorEnabled: false,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    const result = await exec(verifyEmailOtp).handler(ctx, { email: "Shlomo@example.com ", otp });

    expect(result).toMatchObject({
      token: "jwt_1",
      refreshToken: expect.any(String),
      sessionId: "session_1",
      userId: "user_1",
      identityId: "identity_1",
      user: { email: "shlomo@example.com" },
    });

    const provisionCall = (component as any).identity.provisionFromIdentity.mock.calls[0][0];
    expect(provisionCall.identity).toMatchObject({
      provider: "emailOtp",
      issuer: "native",
      subject: "shlomo@example.com",
      email: "shlomo@example.com",
      emailVerified: true,
    });
    expect(provisionCall.user).toMatchObject({
      email: "shlomo@example.com",
      name: "Shlomo",
      emailVerified: true,
    });
    expect(provisionCall.allowLink).toBe(true);
  });

  it("verifyEmailOtp rejects an invalid OTP", async () => {
    const component = createMockComponent();
    const { verifyEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      createConfig(),
    );
    component.native.verifiers.consumeVerifier = vi.fn().mockResolvedValue(null);

    const ctx = createContext();
    await expect(
      exec(verifyEmailOtp).handler(ctx, { email: "shlomo@example.com", otp: "000000" }),
    ).rejects.toThrow("INVALID_OTP");
  });

  it("verifyEmailOtp respects disableSignUp", async () => {
    const component = createMockComponent();
    const { verifyEmailOtp } = nativeEmailOtp(
      component as unknown as NativeEmailAndPasswordComponentHandle,
      { ...createConfig(), disableSignUp: true },
    );
    component.native.verifiers.consumeVerifier = vi.fn().mockResolvedValue({
      _id: "verifier_1",
      verifierId: "verifier_1",
      type: "email-otp",
      metadata: JSON.stringify({ email: "shlomo@example.com" }),
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    component.native.users.getUserByEmail = vi.fn().mockResolvedValue(null);

    const ctx = createContext();
    await expect(
      exec(verifyEmailOtp).handler(ctx, { email: "shlomo@example.com", otp: "000000" }),
    ).rejects.toThrow("SIGN_UP_DISABLED");
    expect((component as any).identity.provisionFromIdentity).not.toHaveBeenCalled();
  });
});
