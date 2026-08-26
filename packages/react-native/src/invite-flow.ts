import type { VortexExpoAuthActionResult } from "./runtime";

export type VortexExpoInviteDeepLink = {
  invitationToken: string;
  rawUrl: string;
};

export type VortexExpoInviteParseResult =
  | { kind: "token"; token: string; rawUrl: string }
  | { kind: "none"; reason: "no_token" | "invalid_url" };

export type VortexExpoInviteActions = {
  parse(url: string | null | undefined): VortexExpoInviteParseResult;
  accept(token: string): Promise<VortexExpoAuthActionResult>;
};

export function parseVortexExpoInvitationUrl(
  url: string | null | undefined
): VortexExpoInviteParseResult {
  if (!url) {
    return { kind: "none", reason: "no_token" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "none", reason: "invalid_url" };
  }

  const token =
    parsed.searchParams.get("invitation_token") ??
    parsed.searchParams.get("token");

  if (!token) {
    return { kind: "none", reason: "no_token" };
  }

  return { kind: "token", token, rawUrl: url };
}
