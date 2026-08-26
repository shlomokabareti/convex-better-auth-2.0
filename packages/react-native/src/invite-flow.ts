import type { ExpoAuthActionResult } from "./runtime";

export type ExpoInviteDeepLink = {
  invitationToken: string;
  rawUrl: string;
};

export type ExpoInviteParseResult =
  | { kind: "token"; token: string; rawUrl: string }
  | { kind: "none"; reason: "no_token" | "invalid_url" };

export type ExpoInviteActions = {
  parse(url: string | null | undefined): ExpoInviteParseResult;
  accept(token: string): Promise<ExpoAuthActionResult>;
};

export function parseExpoInvitationUrl(url: string | null | undefined): ExpoInviteParseResult {
  if (!url) {
    return { kind: "none", reason: "no_token" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "none", reason: "invalid_url" };
  }

  const token = parsed.searchParams.get("invitation_token") ?? parsed.searchParams.get("token");

  if (!token) {
    return { kind: "none", reason: "no_token" };
  }

  return { kind: "token", token, rawUrl: url };
}
