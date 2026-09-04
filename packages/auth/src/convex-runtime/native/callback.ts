function normalizeTrustedOrigins(origins: string[]): string[] {
  return origins
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return "";
      }
    })
    .filter((origin) => origin !== "");
}

export function isAllowedRedirectUrl(
  url: string,
  requestOrigin: string,
  trustedOrigins: string[],
): boolean {
  if (!url.startsWith("http")) {
    return true;
  }

  try {
    const target = new URL(url).origin;
    if (target === requestOrigin) {
      return true;
    }
    const allowed = new Set(normalizeTrustedOrigins(trustedOrigins));
    return allowed.has(target);
  } catch {
    return false;
  }
}
