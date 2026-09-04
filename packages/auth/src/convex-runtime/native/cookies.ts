import { parseCookie, stringifySetCookie } from "cookie";

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
