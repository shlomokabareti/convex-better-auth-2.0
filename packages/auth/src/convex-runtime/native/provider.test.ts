import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { nativeEmailAndPassword } from "./provider.js";
import type {
  NativeAccountDoc,
  NativeEmailAndPasswordComponentHandle,
  NativeIdentityDoc,
  NativeUserDoc,
} from "./types.js";
import { hashToken } from "./tokens.js";
import { hashPassword, verifyPassword } from "./password.js";
import { mintToken, verifyToken } from "./jwt.js";
import type { FunctionReference } from "convex/server";
import type { Mock } from "vitest";
import type { EmailDraft, EmailSender, NativeEmailAndPasswordConfig } from "./provider.js";

async function dispatch(ref: unknown, args: Record<string, unknown>) {
  if (typeof ref === "function") {
    return await (ref as (args: Record<string, unknown>) => unknown)(args);
  }
  return undefined;
}

const DEFAULT_PASSWORD = "hunter2!";
const NEW_PASSWORD = "newHunter2!";
let defaultPasswordHash: string;
let defaultToken: string;
let oneDayToken: string;

async function setupTestKeysAndHashes() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  process.env.JWT_PRIVATE_KEY = JSON.stringify(privateJwk);
  process.env.JWKS = JSON.stringify({ keys: [publicJwk] });
  defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
  defaultToken = await mintToken("user_1", "session_1", { identityId: "identity_1" });
  oneDayToken = await mintToken(
    "user_1",
    "session_1",
    { identityId: "identity_1" },
    {
      expiresInSeconds: 24 * 60 * 60,
    },
  );
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
    handler: async (ctx: unknown, args: Record<string, unknown>): Promise<unknown> =>
      await Reflect.apply(handler, registered, [ctx, args]),
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
    ? Mock<(args: Args) => Promise<Awaited<Return>>>
    : T[K] extends Record<string, unknown>
      ? Mockify<T[K]>
      : T[K];
};

type MockedComponent = Mockify<NativeEmailAndPasswordComponentHandle>;

function createMockComponent(): MockedComponent {
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
        createSessionAndRefreshToken: vi.fn(),
        revokeSession: vi.fn(),
        listSessionsByUser: vi.fn(),
        getSessionByToken: vi.fn(),
        getSessionBySessionId: vi.fn(),
        revokeSessionsForUser: vi.fn(),
        rotateSession: vi.fn(),
      },
      refreshTokens: {
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
      },
      codes: {
        createVerificationCode: vi.fn(),
        getVerificationCodeByTokenHash: vi.fn(),
        consumeVerificationCode: vi.fn(),
        revokeVerificationCodesForUser: vi.fn(),
      },
    },
  } as unknown as MockedComponent;
}

function createContext() {
  return {
    runQuery: vi.fn((ref: unknown, args: Record<string, unknown>) => dispatch(ref, args)),
    runMutation: vi.fn((ref: unknown, args: Record<string, unknown>) => dispatch(ref, args)),
  };
}

function makeUser(overrides: Partial<NativeUserDoc> = {}): NativeUserDoc {
  return {
    _id: "user_1",
    _creationTime: 0,
    email: "shlomo@example.com",
    emailVerified: false,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeIdentity(overrides: Partial<NativeIdentityDoc> = {}): NativeIdentityDoc {
  return {
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
    ...overrides,
  };
}

function makeAccount(overrides: Partial<NativeAccountDoc> = {}): NativeAccountDoc {
  return {
    _id: "account_1",
    _creationTime: 0,
    userId: "user_1",
    provider: "password",
    issuer: "native",
    subject: "subject_1",
    credentialHash: defaultPasswordHash,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function extractTokenFromHtml(html: string): string | null {
  const match = html.match(/token=([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

function asComponent(component: MockedComponent): NativeEmailAndPasswordComponentHandle {
  return component as unknown as NativeEmailAndPasswordComponentHandle;
}

function createActions(component: MockedComponent, config?: NativeEmailAndPasswordConfig) {
  return nativeEmailAndPassword(asComponent(component), config);
}

describe("nativeEmailAndPassword", () => {
  beforeAll(setupTestKeysAndHashes);

  it("signs up a new user", async () => {
    const component = createMockComponent();
    const user = makeUser();
    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
      user,
      sessionId: "session_1",
      token: defaultToken,
    });

    const { signUp } = createActions(component);
    const { handler } = exec(signUp);
    const result = (await handler(createContext(), {
      email: "Shlomo@example.com ",
      password: DEFAULT_PASSWORD,
      name: "Shlomo",
    })) as {
      token?: string;
      user: { id: string; email?: string };
      userId?: string;
      identityId?: string;
      sessionId?: string;
    };

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: defaultToken,
      sessionId: "session_1",
    });
    expect(result.user).toMatchObject({
      id: user._id,
      email: user.email,
      name: user.name,
    });

    const provisionCall = component.identity.provisionFromIdentity.mock.calls[0]?.[0];
    expect(provisionCall.identity.email).toBe("shlomo@example.com");
    expect(provisionCall.identity.provider).toBe("password");
    expect(provisionCall.identity.issuer).toBe("native");
    expect(provisionCall.user.email).toBe("shlomo@example.com");
    expect(provisionCall.allowLink).toBe(false);

    const account = provisionCall.account;
    expect(account).toMatchObject({
      credentialHash: expect.any(String),
    });
    expect(await verifyPassword(DEFAULT_PASSWORD, account.credentialHash)).toBe(true);

    expect(provisionCall.verificationCode).toBeUndefined();
    expect(provisionCall.initialSession).toBeDefined();
    expect(provisionCall.initialSession).toMatchObject({
      sessionId: expect.any(String),
      sessionExpiresAt: expect.any(Number),
      refreshTokenHash: expect.any(String),
      refreshTokenExpiresAt: expect.any(Number),
    });
    expect(component.native.sessions.createSessionAndRefreshToken).not.toHaveBeenCalled();

    const payload = await verifyToken(result.token);
    expect(payload.sub).toBe("user_1");
    expect(payload.sessionId).toBe(result.sessionId);
    expect(payload.identityId).toBe("identity_1");
  });

  it("signs up with rememberMe false uses a 1-day session and token TTL", async () => {
    const component = createMockComponent();
    const user = makeUser();
    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      identityId: "identity_1",
      createdUser: true,
      linkedExistingIdentity: false,
      user,
      sessionId: "session_1",
      token: oneDayToken,
    });

    const { signUp } = createActions(component);
    const { handler } = exec(signUp);
    const before = Date.now();
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
      name: "Shlomo",
      rememberMe: false,
    })) as {
      token?: string;
      user: { id: string };
      sessionId?: string;
    };
    const after = Date.now();

    const provisionCall = component.identity.provisionFromIdentity.mock.calls[0]?.[0];
    expect(provisionCall.initialSession.sessionExpiresAt).toBeGreaterThanOrEqual(
      before + 24 * 60 * 60 * 1000,
    );
    expect(provisionCall.initialSession.sessionExpiresAt).toBeLessThanOrEqual(
      after + 24 * 60 * 60 * 1000,
    );

    const payload = await verifyToken(result.token);
    expect(payload.sub).toBe("user_1");
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect((payload.exp as number) - (payload.iat as number)).toBe(24 * 60 * 60);
  });

  it("signUp rejects an invalid email", async () => {
    const component = createMockComponent();
    const { signUp } = createActions(component);
    const { handler } = exec(signUp);
    await expect(
      handler(createContext(), {
        email: "not-an-email",
        password: DEFAULT_PASSWORD,
        name: "Shlomo",
      }),
    ).rejects.toThrow("Invalid email");
  });

  it("signUp rejects a short password", async () => {
    const component = createMockComponent();
    const { signUp } = createActions(component);
    const { handler } = exec(signUp);
    await expect(
      handler(createContext(), { email: "shlomo@example.com", password: "short", name: "Shlomo" }),
    ).rejects.toThrow("too short");
  });

  it("signUp rejects when email and password is disabled", async () => {
    const component = createMockComponent();
    const { signUp } = createActions(component, { enabled: false });
    const { handler } = exec(signUp);
    await expect(
      handler(createContext(), {
        email: "shlomo@example.com",
        password: DEFAULT_PASSWORD,
        name: "Shlomo",
      }),
    ).rejects.toThrow("disabled");
  });

  it("signUp rejects when sign up is disabled", async () => {
    const component = createMockComponent();
    const { signUp } = createActions(component, { disableSignUp: true });
    const { handler } = exec(signUp);
    await expect(
      handler(createContext(), {
        email: "shlomo@example.com",
        password: DEFAULT_PASSWORD,
        name: "Shlomo",
      }),
    ).rejects.toThrow("Sign up is disabled");
  });

  it("signUp throws when the email already exists", async () => {
    const component = createMockComponent();
    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      createdUser: false,
      linkedExistingIdentity: false,
      duplicate: true,
    });
    const { signUp } = createActions(component);
    const { handler } = exec(signUp);
    await expect(
      handler(createContext(), {
        email: "shlomo@example.com",
        password: DEFAULT_PASSWORD,
        name: "Shlomo",
      }),
    ).rejects.toThrow("already exists");
  });

  it("signUp returns a generic duplicate response when requireVerifiedEmail is true", async () => {
    const component = createMockComponent();
    component.identity.provisionFromIdentity.mockResolvedValue({
      userId: "user_1",
      createdUser: false,
      linkedExistingIdentity: false,
      duplicate: true,
    });
    const { signUp } = createActions(component, { requireVerifiedEmail: true });
    const { handler } = exec(signUp);
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
      name: "Shlomo",
    })) as { token: string | null; user: { id: string; email?: string } };
    expect(result.token).toBeNull();
    expect(result.user.email).toBe("shlomo@example.com");
    expect(result.user.id).toEqual(expect.any(String));
    const provisionCall = component.identity.provisionFromIdentity.mock.calls[0]?.[0];
    expect(provisionCall.initialSession).toBeUndefined();
    expect(component.native.sessions.createSessionAndRefreshToken).not.toHaveBeenCalled();
  });

  it("signs in an existing user with a valid password", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: true });
    const identity = makeIdentity({ emailVerified: true });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });
    component.native.sessions.createSessionAndRefreshToken.mockResolvedValue("session_1");

    const { signIn } = createActions(component);
    const { handler } = exec(signIn);
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
    })) as {
      token: string;
      user: { id: string; email?: string };
      userId: string;
      identityId: string;
      sessionId: string;
    };

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: expect.any(String),
      sessionId: expect.any(String),
    });
    expect(result.user).toMatchObject({
      id: user._id,
      email: user.email,
      name: user.name,
    });

    expect(component.identity.getUserAndAccount).toHaveBeenCalledWith({
      email: "shlomo@example.com",
    });

    const payload = await verifyToken(result.token);
    expect(payload.sub).toBe("user_1");
    expect(payload.sessionId).toBe(result.sessionId);
    expect(payload.identityId).toBe("identity_1");
  });

  it("signs in with rememberMe false uses a 1-day session and token TTL", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: true });
    const identity = makeIdentity({ emailVerified: true });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });
    component.native.sessions.createSessionAndRefreshToken.mockResolvedValue("session_1");

    const { signIn } = createActions(component);
    const { handler } = exec(signIn);
    const before = Date.now();
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
      rememberMe: false,
    })) as {
      token: string;
      sessionId: string;
    };
    const after = Date.now();

    const createSessionAndRefreshTokenCall =
      component.native.sessions.createSessionAndRefreshToken.mock.calls[0]?.[0];
    expect(createSessionAndRefreshTokenCall.sessionExpiresAt).toBeGreaterThanOrEqual(
      before + 24 * 60 * 60 * 1000,
    );
    expect(createSessionAndRefreshTokenCall.sessionExpiresAt).toBeLessThanOrEqual(
      after + 24 * 60 * 60 * 1000,
    );

    const payload = await verifyToken(result.token);
    expect((payload.exp as number) - (payload.iat as number)).toBe(24 * 60 * 60);
  });

  it("signIn rejects an unverified email when requireVerifiedEmail is true", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: false });
    const identity = makeIdentity({ emailVerified: false });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });

    const { signIn } = createActions(component, { requireVerifiedEmail: true });
    const { handler } = exec(signIn);

    await expect(
      handler(createContext(), { email: "shlomo@example.com", password: DEFAULT_PASSWORD }),
    ).rejects.toThrow("Email not verified");

    expect(component.native.sessions.createSessionAndRefreshToken).not.toHaveBeenCalled();
  });

  it("signIn allows an unverified email by default", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: false });
    const identity = makeIdentity({ emailVerified: false });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });
    component.native.sessions.createSessionAndRefreshToken.mockResolvedValue("session_1");

    const { signIn } = createActions(component);
    const { handler } = exec(signIn);
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
    })) as {
      token: string;
      user: { id: string; email?: string };
      userId: string;
      identityId: string;
      sessionId: string;
    };

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: expect.any(String),
      sessionId: expect.any(String),
    });
    expect(result.user).toMatchObject({
      id: user._id,
      email: user.email,
      name: user.name,
    });
  });

  it("signIn allows a verified email when requireVerifiedEmail is true", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: true });
    const identity = makeIdentity({ emailVerified: true });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });
    component.native.sessions.createSessionAndRefreshToken.mockResolvedValue("session_1");

    const { signIn } = createActions(component, { requireVerifiedEmail: true });
    const { handler } = exec(signIn);
    const result = (await handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
    })) as {
      token: string;
      user: { id: string; email?: string };
      userId: string;
      identityId: string;
      sessionId: string;
    };

    expect(result).toMatchObject({
      userId: "user_1",
      identityId: "identity_1",
      token: expect.any(String),
      sessionId: expect.any(String),
    });
    expect(result.user).toMatchObject({
      id: user._id,
      email: user.email,
      name: user.name,
    });
  });

  it("signOut verifies the token and revokes the session", async () => {
    const component = createMockComponent();
    const user = makeUser({ emailVerified: true });
    const identity = makeIdentity({ emailVerified: true });
    const account = makeAccount();
    component.identity.getUserAndAccount.mockResolvedValue({ user, identity, account });
    component.native.sessions.createSessionAndRefreshToken.mockResolvedValue("session_1");

    const { signIn, signOut } = createActions(component);
    const signInResult = (await exec(signIn).handler(createContext(), {
      email: "shlomo@example.com",
      password: DEFAULT_PASSWORD,
    })) as {
      token: string;
      sessionId: string;
    };

    const signOutResult = await exec(signOut).handler(createContext(), {
      token: signInResult.token,
    });
    expect(signOutResult).toEqual({ success: true, redirect: false, url: undefined });

    expect(component.native.sessions.revokeSession).toHaveBeenCalledWith({
      sessionId: signInResult.sessionId,
    });
  });

  describe("sendEmailVerification", () => {
    it("queues and sends a verification email with a token URL", async () => {
      const component = createMockComponent();
      const user = makeUser();
      component.native.users.getUserByEmail.mockResolvedValue(user);
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendEmailVerification } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const { handler } = exec(sendEmailVerification);
      const result = (await handler(createContext(), { email: "Shlomo@example.com" })) as {
        status: string;
        emailId?: string;
      };

      expect(result).toEqual({ status: "queued", emailId: "email_1" });

      expect(component.native.users.getUserByEmail).toHaveBeenCalledWith({
        email: "shlomo@example.com",
      });

      const createCall = component.native.codes.createVerificationCode.mock.calls[0]?.[0];
      expect(createCall).toMatchObject({
        userId: user._id,
        type: "email_verification",
        expiresAt: expect.any(Number),
      });

      const draft = sendEmail.mock.calls[0]?.[0] as EmailDraft;
      expect(draft).toBeDefined();
      expect(draft.from).toBe("test@example.com");
      expect(draft.to).toBe(user.email);
      expect(draft.html).toContain("Verify your email");

      const token = extractTokenFromHtml(draft.html);
      expect(token).not.toBeNull();
      if (token === null) throw new Error("token not found in email html");
      expect(draft.html).toContain(token);
      expect(createCall.tokenHash).toBe(hashToken(token));
    });

    it("returns not_configured when from or sendEmail is missing", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(makeUser());

      const { sendEmailVerification: missingFrom } = createActions(component, {
        email: { sendEmail: vi.fn<EmailSender>().mockResolvedValue("email_1") },
      });
      const { sendEmailVerification: missingSendEmail } = createActions(component, {
        email: { from: "test@example.com" },
      });

      const missingFromResult = await exec(missingFrom).handler(createContext(), {
        email: "shlomo@example.com",
      });
      const missingSendEmailResult = await exec(missingSendEmail).handler(createContext(), {
        email: "shlomo@example.com",
      });

      expect(missingFromResult).toEqual({
        status: "not_configured",
        reason: "missing_email_config",
      });
      expect(missingSendEmailResult).toEqual({
        status: "not_configured",
        reason: "missing_email_config",
      });
      expect(component.native.codes.createVerificationCode).not.toHaveBeenCalled();
      expect(component.native.users.getUserByEmail).not.toHaveBeenCalled();
    });

    it("returns not_configured when the URL is null", async () => {
      const component = createMockComponent();
      const user = makeUser();
      component.native.users.getUserByEmail.mockResolvedValue(user);
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendEmailVerification } = createActions(component, {
        email: { from: "test@example.com", sendEmail },
      });
      const { handler } = exec(sendEmailVerification);
      const result = await handler(createContext(), { email: "shlomo@example.com" });

      expect(result).toEqual({ status: "not_configured", reason: "missing_verify_url" });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns noop for an unknown user", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(null);
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendEmailVerification } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const result = await exec(sendEmailVerification).handler(createContext(), {
        email: "unknown@example.com",
      });

      expect(result).toEqual({ status: "queued", emailId: "noop" });
      expect(component.native.codes.createVerificationCode).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns failed when sendEmail throws", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(makeUser());
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockRejectedValue(new Error("boom"));

      const { sendEmailVerification } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const result = await exec(sendEmailVerification).handler(createContext(), {
        email: "shlomo@example.com",
      });

      expect(result).toEqual({ status: "failed", reason: "boom" });
      expect(component.native.codes.createVerificationCode).toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    it("returns success for a valid token", async () => {
      const component = createMockComponent();
      const token = "verify-token";
      component.identity.verifyEmail.mockResolvedValue({ success: true });

      const { verifyEmail } = createActions(component);
      const result = await exec(verifyEmail).handler(createContext(), { token });

      expect(result).toEqual({ success: true });
      expect(component.identity.verifyEmail).toHaveBeenCalledWith({
        tokenHash: hashToken(token),
        provider: "password",
        issuer: "native",
      });
    });

    it("returns invalid for a non-existent token", async () => {
      const component = createMockComponent();
      component.identity.verifyEmail.mockResolvedValue({ success: false, reason: "invalid" });

      const { verifyEmail } = createActions(component);
      const result = await exec(verifyEmail).handler(createContext(), { token: "missing" });

      expect(result).toEqual({ success: false, reason: "invalid" });
    });

    it("returns expired for an expired token", async () => {
      const component = createMockComponent();
      component.identity.verifyEmail.mockResolvedValue({ success: false, reason: "expired" });

      const { verifyEmail } = createActions(component);
      const result = await exec(verifyEmail).handler(createContext(), { token: "expired" });

      expect(result).toEqual({ success: false, reason: "expired" });
    });
  });

  describe("sendPasswordReset", () => {
    it("queues and sends a reset email with a token URL", async () => {
      const component = createMockComponent();
      const user = makeUser();
      component.native.users.getUserByEmail.mockResolvedValue(user);
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendPasswordReset } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const { handler } = exec(sendPasswordReset);
      const result = (await handler(createContext(), { email: "Shlomo@example.com" })) as {
        status: string;
        emailId?: string;
      };

      expect(result).toEqual({ status: "queued", emailId: "email_1" });

      const createCall = component.native.codes.createVerificationCode.mock.calls[0]?.[0];
      expect(createCall).toMatchObject({
        userId: user._id,
        type: "password_reset",
        expiresAt: expect.any(Number),
      });

      const draft = sendEmail.mock.calls[0]?.[0] as EmailDraft;
      expect(draft).toBeDefined();
      expect(draft.from).toBe("test@example.com");
      expect(draft.to).toBe(user.email);
      expect(draft.html).toContain("Reset your password");

      const token = extractTokenFromHtml(draft.html);
      expect(token).not.toBeNull();
      if (token === null) throw new Error("token not found in email html");
      expect(draft.html).toContain(token);
      expect(createCall.tokenHash).toBe(hashToken(token));
    });

    it("returns not_configured when from or sendEmail is missing", async () => {
      const component = createMockComponent();

      const { sendPasswordReset: missingFrom } = createActions(component, {
        email: { sendEmail: vi.fn<EmailSender>().mockResolvedValue("email_1") },
      });
      const { sendPasswordReset: missingSendEmail } = createActions(component, {
        email: { from: "test@example.com" },
      });

      const missingFromResult = await exec(missingFrom).handler(createContext(), {
        email: "shlomo@example.com",
      });
      const missingSendEmailResult = await exec(missingSendEmail).handler(createContext(), {
        email: "shlomo@example.com",
      });

      expect(missingFromResult).toEqual({
        status: "not_configured",
        reason: "missing_email_config",
      });
      expect(missingSendEmailResult).toEqual({
        status: "not_configured",
        reason: "missing_email_config",
      });
    });

    it("returns not_configured when the URL is null", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(makeUser());
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendPasswordReset } = createActions(component, {
        email: { from: "test@example.com", sendEmail },
      });
      const result = await exec(sendPasswordReset).handler(createContext(), {
        email: "shlomo@example.com",
      });

      expect(result).toEqual({ status: "not_configured", reason: "missing_reset_url" });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns noop for an unknown user", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(null);
      const sendEmail = vi.fn<EmailSender>().mockResolvedValue("email_1");

      const { sendPasswordReset } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const result = await exec(sendPasswordReset).handler(createContext(), {
        email: "unknown@example.com",
      });

      expect(result).toEqual({ status: "queued", emailId: "noop" });
      expect(component.native.codes.createVerificationCode).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns failed when sendEmail throws", async () => {
      const component = createMockComponent();
      component.native.users.getUserByEmail.mockResolvedValue(makeUser());
      component.native.codes.createVerificationCode.mockResolvedValue("code_1");
      const sendEmail = vi.fn<EmailSender>().mockRejectedValue(new Error("boom"));

      const { sendPasswordReset } = createActions(component, {
        email: { from: "test@example.com", appOrigin: "http://localhost", sendEmail },
      });
      const result = await exec(sendPasswordReset).handler(createContext(), {
        email: "shlomo@example.com",
      });

      expect(result).toEqual({ status: "failed", reason: "boom" });
    });
  });

  describe("resetPassword", () => {
    it("returns status, hashes the new password, and does not create a session by default", async () => {
      const component = createMockComponent();
      const token = "reset-token";
      const user = makeUser();
      component.identity.resetPassword.mockResolvedValue({ status: true, user });

      const { resetPassword } = createActions(component);
      const result = (await exec(resetPassword).handler(createContext(), {
        token,
        newPassword: NEW_PASSWORD,
      })) as { status: boolean; reason?: string };

      expect(result).toEqual({ status: true });
      expect(component.identity.resetPassword).toHaveBeenCalledWith({
        tokenHash: hashToken(token),
        credentialHash: expect.any(String),
        provider: "password",
        issuer: "native",
        revokeSessions: false,
      });

      const resetCall = component.identity.resetPassword.mock.calls[0]?.[0];
      expect(await verifyPassword(NEW_PASSWORD, resetCall.credentialHash)).toBe(true);
      expect(component.native.sessions.createSessionAndRefreshToken).not.toHaveBeenCalled();
    });

    it("revokes all sessions when revokeSessionsOnPasswordReset is true", async () => {
      const component = createMockComponent();
      component.identity.resetPassword.mockResolvedValue({ status: true });

      const { resetPassword } = createActions(component, { revokeSessionsOnPasswordReset: true });
      const result = (await exec(resetPassword).handler(createContext(), {
        token: "reset-token",
        newPassword: NEW_PASSWORD,
      })) as { status: boolean };

      expect(result).toEqual({ status: true });
      expect(component.identity.resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({ revokeSessions: true }),
      );
    });

    it("returns invalid for a non-existent token", async () => {
      const component = createMockComponent();
      component.identity.resetPassword.mockResolvedValue({ status: false, reason: "invalid" });

      const { resetPassword } = createActions(component);
      const result = await exec(resetPassword).handler(createContext(), {
        token: "missing",
        newPassword: NEW_PASSWORD,
      });

      expect(result).toEqual({ status: false, reason: "invalid" });
    });

    it("returns expired for an expired token", async () => {
      const component = createMockComponent();
      component.identity.resetPassword.mockResolvedValue({ status: false, reason: "expired" });

      const { resetPassword } = createActions(component);
      const result = await exec(resetPassword).handler(createContext(), {
        token: "expired",
        newPassword: NEW_PASSWORD,
      });

      expect(result).toEqual({ status: false, reason: "expired" });
    });

    it("rejects a short or long password", async () => {
      const component = createMockComponent();

      const { resetPassword } = createActions(component);
      const short = await exec(resetPassword).handler(createContext(), {
        token: "reset-token",
        newPassword: "short",
      });
      expect(short).toEqual({ status: false, reason: "password_too_short" });
      expect(component.identity.resetPassword).not.toHaveBeenCalled();

      const long = await exec(resetPassword).handler(createContext(), {
        token: "reset-token",
        newPassword: "a".repeat(129),
      });
      expect(long).toEqual({ status: false, reason: "password_too_long" });
    });

    it("calls onPasswordReset after a successful reset", async () => {
      const component = createMockComponent();
      const user = makeUser();
      component.identity.resetPassword.mockResolvedValue({ status: true, user });
      const onPasswordReset = vi.fn().mockResolvedValue(undefined);

      const { resetPassword } = createActions(component, { onPasswordReset });
      const result = (await exec(resetPassword).handler(createContext(), {
        token: "reset-token",
        newPassword: NEW_PASSWORD,
      })) as { status: boolean };

      expect(result).toEqual({ status: true });
      expect(onPasswordReset).toHaveBeenCalledWith({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          isActive: true,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    });
  });

  describe("verifyPassword", () => {
    it("verifies the current password", async () => {
      const component = createMockComponent();
      const sessionToken = await mintToken("user_1", "session_1");
      const identity = makeIdentity();
      const account = makeAccount({ credentialHash: defaultPasswordHash });
      component.native.sessions.getSessionByToken.mockResolvedValue({
        _id: "session_doc_1",
        sessionId: "session_1",
        userId: "user_1",
        token: sessionToken,
        expiresAt: Date.now() + 60_000,
      });
      component.native.identities.getNativeIdentityByUser.mockResolvedValue(identity);
      component.native.accounts.getAccountBySubject.mockResolvedValue(account);

      const { verifyPassword } = createActions(component);
      const result = await exec(verifyPassword).handler(createContext(), {
        token: sessionToken,
        password: DEFAULT_PASSWORD,
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("updateSession", () => {
    it("rotates a refresh token into a new session and token pair", async () => {
      const component = createMockComponent();
      const user = makeUser();
      const identity = makeIdentity();
      const refreshToken = "refresh-token";
      const refreshTokenHash = hashToken(refreshToken);

      component.native.refreshTokens.getRefreshTokenByTokenHash.mockResolvedValue({
        _id: "refresh_doc_1",
        _creationTime: 0,
        tokenHash: refreshTokenHash,
        sessionId: "session_1",
        userId: "user_1",
        expiresAt: Date.now() + 60_000,
        createdAt: 0,
        updatedAt: 0,
      });
      component.native.sessions.getSessionBySessionId.mockResolvedValue({
        _id: "session_doc_1",
        _creationTime: 0,
        sessionId: "session_1",
        userId: "user_1",
        token: "old-token",
        expiresAt: Date.now() + 60_000,
        createdAt: 0,
        updatedAt: 0,
      });
      component.native.users.getUserById.mockResolvedValue(user);
      component.native.identities.getNativeIdentityByUser.mockResolvedValue(identity);
      component.native.sessions.rotateSession.mockResolvedValue({
        user,
        identityId: "identity_1",
      });

      const { updateSession } = createActions(component);
      const result = (await exec(updateSession).handler(createContext(), {
        refreshToken,
      })) as {
        token: string;
        refreshToken: string;
        userId: string;
        sessionId: string;
        identityId: string;
      };

      expect(result).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        userId: "user_1",
        identityId: "identity_1",
        sessionId: expect.any(String),
      });

      const rotateCall = component.native.sessions.rotateSession.mock.calls[0]?.[0];
      expect(rotateCall.oldRefreshTokenHash).toBe(refreshTokenHash);
      expect(rotateCall.newSessionId).toBe(result.sessionId);
      expect(rotateCall.newSessionToken).toBe(result.token);
      expect(rotateCall.newSessionExpiresAt).toBeGreaterThan(Date.now());
      expect(rotateCall.newRefreshTokenHash).toBe(hashToken(result.refreshToken));
      expect(rotateCall.newRefreshTokenExpiresAt).toBeGreaterThan(Date.now());
      expect(rotateCall.provider).toBe("password");
      expect(rotateCall.issuer).toBe("native");

      const payload = await verifyToken(result.token);
      expect(payload.sub).toBe("user_1");
      expect(payload.sessionId).toBe(result.sessionId);
      expect(payload.identityId).toBe("identity_1");
    });

    it("rejects an unknown refresh token", async () => {
      const component = createMockComponent();
      component.native.refreshTokens.getRefreshTokenByTokenHash.mockResolvedValue(null);

      const { updateSession } = createActions(component);
      await expect(
        exec(updateSession).handler(createContext(), { refreshToken: "unknown" }),
      ).rejects.toThrow("Invalid refresh token");
    });
  });
});
