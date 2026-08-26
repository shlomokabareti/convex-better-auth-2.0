import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  BETTER_AUTH_TEST_BASE_PATH,
  BETTER_AUTH_TEST_BASE_URL,
  createBetterAuthTestInstance,
  type BetterAuthTestInstance,
  type BetterAuthTestOtpDelivery,
} from "./test-auth";

const TEST_PASSWORD = "12345678";
const RESET_PASSWORD = "reset12345";
const REPLAY_PASSWORD = "replay12345";
const MIXUP_PASSWORD = "mixup12345";

describe("Better Auth reset and verification token misuse rejection", () => {
  it("accepts a fresh core reset URL token once and rejects replay without a second reset", async () => {
    const instance = createBetterAuthTestInstance();
    const email = uniqueEmail("core-reset-replay");
    await signUp(instance, email, TEST_PASSWORD);

    const token = await requestCoreResetToken(instance, email);
    await assertStatus(await resetCorePassword(instance, token, RESET_PASSWORD), 200);
    assert.equal(await signInStatus(instance, email, RESET_PASSWORD), 200);

    await assertRejected(await resetCorePassword(instance, token, REPLAY_PASSWORD));
    assert.notEqual(await signInStatus(instance, email, REPLAY_PASSWORD), 200);
    assert.equal(await signInStatus(instance, email, RESET_PASSWORD), 200);
  });

  it("rejects expired core reset URL tokens and accepts an unexpired control token", async () => {
    const expiredInstance = createBetterAuthTestInstance({
      resetPasswordTokenExpiresIn: -1,
    });
    const expiredEmail = uniqueEmail("core-reset-expired");
    await signUp(expiredInstance, expiredEmail, TEST_PASSWORD);

    const expiredToken = await requestCoreResetToken(expiredInstance, expiredEmail);
    await assertRejected(await resetCorePassword(expiredInstance, expiredToken, RESET_PASSWORD));
    assert.equal(await signInStatus(expiredInstance, expiredEmail, TEST_PASSWORD), 200);
    assert.notEqual(await signInStatus(expiredInstance, expiredEmail, RESET_PASSWORD), 200);

    const controlInstance = createBetterAuthTestInstance();
    const controlEmail = uniqueEmail("core-reset-expiry-control");
    await signUp(controlInstance, controlEmail, TEST_PASSWORD);

    const controlToken = await requestCoreResetToken(controlInstance, controlEmail);
    await assertStatus(await resetCorePassword(controlInstance, controlToken, RESET_PASSWORD), 200);
    assert.equal(await signInStatus(controlInstance, controlEmail, RESET_PASSWORD), 200);
  });

  it("accepts a fresh reset OTP once and rejects replay without a second reset", async () => {
    const instance = createBetterAuthTestInstance();
    const email = uniqueEmail("otp-reset-replay");
    await signUp(instance, email, TEST_PASSWORD);

    const otp = await requestResetOtp(instance, email);
    await assertStatus(await resetPasswordWithOtp(instance, email, otp, RESET_PASSWORD), 200);
    assert.equal(await signInStatus(instance, email, RESET_PASSWORD), 200);

    await assertRejected(await resetPasswordWithOtp(instance, email, otp, REPLAY_PASSWORD));
    assert.notEqual(await signInStatus(instance, email, REPLAY_PASSWORD), 200);
    assert.equal(await signInStatus(instance, email, RESET_PASSWORD), 200);
  });

  it("rejects expired reset OTPs and accepts an unexpired control OTP", async () => {
    const expiredInstance = createBetterAuthTestInstance({
      emailOtpExpiresIn: -1,
    });
    const expiredEmail = uniqueEmail("otp-reset-expired");
    await signUp(expiredInstance, expiredEmail, TEST_PASSWORD);

    const expiredOtp = await requestResetOtp(expiredInstance, expiredEmail);
    await assertRejected(
      await resetPasswordWithOtp(expiredInstance, expiredEmail, expiredOtp, RESET_PASSWORD),
    );
    assert.equal(await signInStatus(expiredInstance, expiredEmail, TEST_PASSWORD), 200);
    assert.notEqual(await signInStatus(expiredInstance, expiredEmail, RESET_PASSWORD), 200);

    const controlInstance = createBetterAuthTestInstance();
    const controlEmail = uniqueEmail("otp-reset-expiry-control");
    await signUp(controlInstance, controlEmail, TEST_PASSWORD);

    const controlOtp = await requestResetOtp(controlInstance, controlEmail);
    await assertStatus(
      await resetPasswordWithOtp(controlInstance, controlEmail, controlOtp, RESET_PASSWORD),
      200,
    );
    assert.equal(await signInStatus(controlInstance, controlEmail, RESET_PASSWORD), 200);
  });

  it("rejects a reset OTP issued for account A when submitted for account B", async () => {
    const instance = createBetterAuthTestInstance();
    const emailA = uniqueEmail("otp-reset-account-a");
    const emailB = uniqueEmail("otp-reset-account-b");
    await signUp(instance, emailA, TEST_PASSWORD);
    await signUp(instance, emailB, TEST_PASSWORD);

    const otpForA = await requestResetOtp(instance, emailA);

    await assertRejected(await resetPasswordWithOtp(instance, emailB, otpForA, MIXUP_PASSWORD));
    assert.equal(await signInStatus(instance, emailB, TEST_PASSWORD), 200);
    assert.notEqual(await signInStatus(instance, emailB, MIXUP_PASSWORD), 200);

    await assertStatus(await resetPasswordWithOtp(instance, emailA, otpForA, RESET_PASSWORD), 200);
    assert.equal(await signInStatus(instance, emailA, RESET_PASSWORD), 200);
  });

  it("accepts a fresh email-verification OTP once and rejects replay", async () => {
    const instance = createBetterAuthTestInstance();
    const email = uniqueEmail("verification-replay");
    await saveUnverifiedUser(instance, email);

    const otp = await sendEmailVerificationOtp(instance, email);
    await assertStatus(await verifyEmailWithOtp(instance, email, otp), 200);
    assert.equal(await isEmailVerified(instance, email), true);

    await assertRejected(await verifyEmailWithOtp(instance, email, otp));
  });

  it("rejects expired email-verification OTPs and accepts an unexpired control OTP", async () => {
    const expiredInstance = createBetterAuthTestInstance({
      emailOtpExpiresIn: -1,
    });
    const expiredEmail = uniqueEmail("verification-expired");
    await saveUnverifiedUser(expiredInstance, expiredEmail);

    const expiredOtp = await sendEmailVerificationOtp(expiredInstance, expiredEmail);
    await assertRejected(await verifyEmailWithOtp(expiredInstance, expiredEmail, expiredOtp));
    assert.equal(await isEmailVerified(expiredInstance, expiredEmail), false);

    const controlInstance = createBetterAuthTestInstance();
    const controlEmail = uniqueEmail("verification-expiry-control");
    await saveUnverifiedUser(controlInstance, controlEmail);

    const controlOtp = await sendEmailVerificationOtp(controlInstance, controlEmail);
    await assertStatus(await verifyEmailWithOtp(controlInstance, controlEmail, controlOtp), 200);
    assert.equal(await isEmailVerified(controlInstance, controlEmail), true);
  });

  it("rejects an email-verification OTP issued for account A when submitted for account B", async () => {
    const instance = createBetterAuthTestInstance();
    const emailA = uniqueEmail("verification-account-a");
    const emailB = uniqueEmail("verification-account-b");
    await saveUnverifiedUser(instance, emailA);
    await saveUnverifiedUser(instance, emailB);

    const otpForA = await sendEmailVerificationOtp(instance, emailA);

    await assertRejected(await verifyEmailWithOtp(instance, emailB, otpForA));
    assert.equal(await isEmailVerified(instance, emailB), false);

    await assertStatus(await verifyEmailWithOtp(instance, emailA, otpForA), 200);
    assert.equal(await isEmailVerified(instance, emailA), true);
  });
});

type AuthRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  cookie?: string;
};

async function authRequest(
  instance: BetterAuthTestInstance,
  path: string,
  options: AuthRequestOptions = {},
): Promise<Response> {
  const headers = new Headers();
  headers.set("origin", BETTER_AUTH_TEST_BASE_URL);
  if (options.cookie !== undefined) {
    headers.set("cookie", options.cookie);
  }
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  return instance.auth.handler(
    new Request(`${BETTER_AUTH_TEST_BASE_URL}${BETTER_AUTH_TEST_BASE_PATH}${path}`, init),
  );
}

async function signUp(
  instance: BetterAuthTestInstance,
  email: string,
  password: string,
): Promise<void> {
  const response = await authRequest(instance, "/sign-up/email", {
    method: "POST",
    body: {
      name: "Token Misuse Test",
      email,
      password,
    },
  });
  await assertStatus(response, 200);
}

async function signInStatus(
  instance: BetterAuthTestInstance,
  email: string,
  password: string,
): Promise<number> {
  const response = await authRequest(instance, "/sign-in/email", {
    method: "POST",
    body: {
      email,
      password,
    },
  });
  return response.status;
}

async function requestCoreResetToken(
  instance: BetterAuthTestInstance,
  email: string,
): Promise<string> {
  const before = instance.deliveredPasswordResets.length;
  const response = await authRequest(instance, "/request-password-reset", {
    method: "POST",
    body: { email },
  });
  await assertStatus(response, 200);

  assert.equal(instance.deliveredPasswordResets.length, before + 1);
  const delivery = instance.deliveredPasswordResets[instance.deliveredPasswordResets.length - 1];
  assert.ok(delivery);
  assert.equal(delivery.email, email);
  assert.ok(delivery.url.includes(delivery.token));
  return delivery.token;
}

function resetCorePassword(
  instance: BetterAuthTestInstance,
  token: string,
  newPassword: string,
): Promise<Response> {
  return authRequest(instance, "/reset-password", {
    method: "POST",
    body: {
      token,
      newPassword,
    },
  });
}

async function requestResetOtp(instance: BetterAuthTestInstance, email: string): Promise<string> {
  const before = instance.deliveredOtps.length;
  const response = await authRequest(instance, "/email-otp/request-password-reset", {
    method: "POST",
    body: { email },
  });
  await assertStatus(response, 200);

  const delivery = requireLatestOtpDelivery(instance, before);
  assert.equal(delivery.email, email);
  assert.equal(delivery.type, "forget-password");
  return delivery.otp;
}

function resetPasswordWithOtp(
  instance: BetterAuthTestInstance,
  email: string,
  otp: string,
  password: string,
): Promise<Response> {
  return authRequest(instance, "/email-otp/reset-password", {
    method: "POST",
    body: {
      email,
      otp,
      password,
    },
  });
}

async function saveUnverifiedUser(instance: BetterAuthTestInstance, email: string): Promise<void> {
  const ctx = await instance.auth.$context;
  const user = ctx.test.createUser({
    email,
    emailVerified: false,
    name: "Verification Token Misuse Test",
  });
  await ctx.test.saveUser(user);
}

async function sendEmailVerificationOtp(
  instance: BetterAuthTestInstance,
  email: string,
): Promise<string> {
  const before = instance.deliveredOtps.length;
  const response = await authRequest(instance, "/email-otp/send-verification-otp", {
    method: "POST",
    body: {
      email,
      type: "email-verification",
    },
  });
  await assertStatus(response, 200);

  const delivery = requireLatestOtpDelivery(instance, before);
  assert.equal(delivery.email, email);
  assert.equal(delivery.type, "email-verification");
  return delivery.otp;
}

function verifyEmailWithOtp(
  instance: BetterAuthTestInstance,
  email: string,
  otp: string,
): Promise<Response> {
  return authRequest(instance, "/email-otp/verify-email", {
    method: "POST",
    body: {
      email,
      otp,
    },
  });
}

async function isEmailVerified(instance: BetterAuthTestInstance, email: string): Promise<boolean> {
  const ctx = await instance.auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email);
  assert.ok(found);
  return found.user.emailVerified;
}

function requireLatestOtpDelivery(
  instance: BetterAuthTestInstance,
  previousDeliveryCount: number,
): BetterAuthTestOtpDelivery {
  assert.equal(instance.deliveredOtps.length, previousDeliveryCount + 1);
  const delivery = instance.deliveredOtps[instance.deliveredOtps.length - 1];
  assert.ok(delivery);
  return delivery;
}

async function assertStatus(response: Response, expectedStatus: number): Promise<void> {
  if (response.status !== expectedStatus) {
    assert.fail(
      `Expected HTTP ${expectedStatus}, got ${response.status}: ${await response.text()}`,
    );
  }
}

async function assertRejected(response: Response): Promise<void> {
  if (response.status < 400) {
    assert.fail(
      `Expected token misuse rejection, got HTTP ${response.status}: ${await response.text()}`,
    );
  }
}

function uniqueEmail(label: string): string {
  return `shlomo+better-auth-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@convex.nyc`;
}
