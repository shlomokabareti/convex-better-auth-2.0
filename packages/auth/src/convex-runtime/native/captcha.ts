import { v } from "convex/values";
import { parse } from "../helpers/index.js";

export type CaptchaProvider =
  | "cloudflare-turnstile"
  | "google-recaptcha"
  | "hcaptcha"
  | "captchafox";

export type CaptchaConfig = {
  provider: CaptchaProvider;
  secretKey: string;
  endpoints?: string[];
};

export const DEFAULT_CAPTCHA_ENDPOINTS = [
  "/api/auth/sign-up/email",
  "/api/auth/sign-up",
  "/api/auth/request-password-reset",
];

const siteVerifyUrls: Record<CaptchaProvider, string> = {
  "cloudflare-turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  "google-recaptcha": "https://www.google.com/recaptcha/api/siteverify",
  hcaptcha: "https://api.hcaptcha.com/siteverify",
  captchafox: "https://api.captchafox.com/siteverify",
};

const captchaResponseValidator = v.object({
  success: v.boolean(),
  score: v.optional(v.number()),
});

type CaptchaVerifyResult = { ok: true; score?: number } | { ok: false; reason: string };

export async function verifyCaptchaResponse(
  config: CaptchaConfig,
  response: string,
  remoteip?: string,
): Promise<CaptchaVerifyResult> {
  if (!response) {
    return { ok: false, reason: "missing_captcha_response" };
  }

  const body = new URLSearchParams();
  body.set("secret", config.secretKey);
  body.set("response", response);
  if (remoteip) {
    body.set("remoteip", remoteip);
  }

  const url = siteVerifyUrls[config.provider];
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await result.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_provider_response" };
  }

  try {
    const response = parse(captchaResponseValidator, parsed);
    if (!response.success) {
      return { ok: false, reason: "captcha_rejected" };
    }
    return { ok: true, score: response.score };
  } catch {
    return { ok: false, reason: "invalid_provider_response" };
  }
}

export function captchaGatesEndpoint(config: CaptchaConfig, pathname: string): boolean {
  const endpoints = config.endpoints ?? DEFAULT_CAPTCHA_ENDPOINTS;
  for (const endpoint of endpoints) {
    if (endpoint.includes("*")) {
      const pattern = endpoint.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(pathname)) return true;
    } else if (endpoint === pathname) {
      return true;
    }
  }
  return false;
}
