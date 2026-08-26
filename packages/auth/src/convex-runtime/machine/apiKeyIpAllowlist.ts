export type ApiKeyIpAllowlistDecision =
  | {
      ok: true;
      requestIp: string | null;
    }
  | {
      ok: false;
      reason: "missing_ip" | "ip_not_allowed";
      requestIp: string | null;
    };

export function getRequestIpFromHeaders(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export function isIpAllowed(ip: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) {
    return true;
  }

  return allowlist.some((cidr) => ipMatchesCidr(ip, cidr));
}

export function resolveApiKeyIpAllowlist(args: {
  requestIp: string | null;
  allowedIpRanges: readonly string[];
}): ApiKeyIpAllowlistDecision {
  if (args.allowedIpRanges.length === 0) {
    return { ok: true, requestIp: args.requestIp };
  }

  if (args.requestIp === null) {
    return { ok: false, reason: "missing_ip", requestIp: null };
  }

  if (!isIpAllowed(args.requestIp, args.allowedIpRanges)) {
    return { ok: false, reason: "ip_not_allowed", requestIp: args.requestIp };
  }

  return { ok: true, requestIp: args.requestIp };
}

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = (value << 8) | octet;
  }

  return value >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const parts = cidr.trim().split("/");
  if (parts.length > 2) {
    return false;
  }

  const [network, prefixText] = parts;
  if (!network || (parts.length === 2 && !prefixText)) {
    return false;
  }

  const prefix = prefixText === undefined ? 32 : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipValue = parseIpv4(ip);
  const networkValue = parseIpv4(network);
  if (ipValue === null || networkValue === null) {
    return false;
  }

  if (prefix === 0) {
    return true;
  }

  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipValue & mask) === (networkValue & mask);
}
