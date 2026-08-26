import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { emailOTP, testUtils } from "better-auth/plugins";

export const BETTER_AUTH_TEST_BASE_URL = "http://auth.test";
export const BETTER_AUTH_TEST_BASE_PATH = "/api/auth";

export type BetterAuthTestOtpDelivery = {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

export type BetterAuthTestPasswordResetDelivery = {
  email: string;
  token: string;
  url: string;
  userId: string;
};

export type BetterAuthTestInstanceOptions = {
  emailOtpExpiresIn?: number;
  resetPasswordTokenExpiresIn?: number;
};

type BetterAuthTestOptions = BetterAuthOptions & {
  plugins: [ReturnType<typeof testUtils>, ReturnType<typeof emailOTP>];
};

export type BetterAuthTestInstance = {
  auth: Auth<BetterAuthTestOptions>;
  db: MemoryDB;
  deliveredOtps: BetterAuthTestOtpDelivery[];
  deliveredPasswordResets: BetterAuthTestPasswordResetDelivery[];
};

export function createBetterAuthTestInstance(
  options: BetterAuthTestInstanceOptions = {},
): BetterAuthTestInstance {
  const db: MemoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const deliveredOtps: BetterAuthTestOtpDelivery[] = [];
  const deliveredPasswordResets: BetterAuthTestPasswordResetDelivery[] = [];

  const authOptions: BetterAuthTestOptions = {
    secret: "convex-auth-test-utils-secret-only-for-local-tests",
    baseURL: BETTER_AUTH_TEST_BASE_URL,
    basePath: BETTER_AUTH_TEST_BASE_PATH,
    trustedOrigins: [BETTER_AUTH_TEST_BASE_URL],
    database: memoryAdapter(db),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      ...(options.resetPasswordTokenExpiresIn === undefined
        ? {}
        : { resetPasswordTokenExpiresIn: options.resetPasswordTokenExpiresIn }),
      async sendResetPassword(delivery) {
        deliveredPasswordResets.push({
          email: delivery.user.email,
          token: delivery.token,
          url: delivery.url,
          userId: delivery.user.id,
        });
      },
    },
    session: {
      cookieCache: {
        enabled: false,
      },
    },
    rateLimit: {
      enabled: false,
    },
    logger: {
      level: "error",
    },
    plugins: [
      testUtils({ captureOTP: true }),
      emailOTP({
        ...(options.emailOtpExpiresIn === undefined
          ? {}
          : { expiresIn: options.emailOtpExpiresIn }),
        async sendVerificationOTP(delivery) {
          deliveredOtps.push(delivery);
        },
      }),
    ],
  };
  const auth = betterAuth(authOptions);

  return { auth, db, deliveredOtps, deliveredPasswordResets };
}
