import { components } from "./_generated/api";
import { convexAuth } from "convex-auth/convex";

export const auth = convexAuth({
  component: components.convexAuth,
  emailAndPassword: { enabled: true },
});

export const {
  signUp,
  signIn,
  signOut,
  updateSession,
  sendEmailVerification,
  verifyEmail,
  sendPasswordReset,
  resetPassword,
  verifyPassword,
  twoFactorEnable,
  twoFactorVerifyTOTP,
  twoFactorVerifyBackupCode,
  twoFactorDisable,
  twoFactorGenerateBackupCodes,
} = auth;
