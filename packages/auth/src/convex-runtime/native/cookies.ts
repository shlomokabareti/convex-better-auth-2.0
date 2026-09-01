import { parseCookie, stringifySetCookie } from "cookie";
import { parseSetCookie } from "set-cookie-parser";

export function setCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds?: number,
  secure?: boolean,
): string {
  return stringifySetCookie({
    name,
    value,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
    ...(secure ? { secure: true } : {}),
  });
}

export function clearCookieHeader(name: string, secure?: boolean): string {
  return stringifySetCookie({
    name,
    value: undefined,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    ...(secure ? { secure: true } : {}),
  });
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }
  const parsed = parseCookie(cookieHeader);
  return parsed[name];
}

export function extractSessionCookieHeader(response: Response): string | undefined {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader && setCookies.length === 0) {
    setCookies.push(setCookieHeader);
  }
  const pairs: string[] = [];
  for (const header of setCookies) {
    const cookies = parseSetCookie(header);
    for (const { name, value } of cookies) {
      pairs.push(`${name}=${value}`);
    }
  }
  return pairs.length > 0 ? pairs.join("; ") : undefined;
}
