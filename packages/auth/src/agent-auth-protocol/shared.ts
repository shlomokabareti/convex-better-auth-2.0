export type AgentAuthProtocolJsonPrimitive = boolean | number | string | null;

export type AgentAuthProtocolJsonValue =
  | AgentAuthProtocolJsonPrimitive
  | AgentAuthProtocolJsonValue[]
  | { [key: string]: AgentAuthProtocolJsonValue };

export type AgentAuthProtocolJsonObject = {
  [key: string]: AgentAuthProtocolJsonValue;
};

export function readObject(value: unknown, name: string): Record<string, unknown> {
  if (!isObjectRecord(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

export function readRequiredString(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return value;
}

export function readOptionalString(
  object: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${key} must be a non-empty string when present`);
  }
  return value;
}

export function readRequiredInteger(object: Record<string, unknown>, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`${key} must be a safe integer`);
  }
  return value;
}

export function readStringArray(
  value: unknown,
  name: string,
  options: { allowEmpty: boolean },
): string[] {
  if (!Array.isArray(value) || (!options.allowEmpty && value.length === 0)) {
    throw new TypeError(`${name} must be ${options.allowEmpty ? "an" : "a non-empty"} array`);
  }
  const strings = value.map((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new TypeError(`${name}[${index}] must be a non-empty string`);
    }
    return item;
  });
  if (new Set(strings).size !== strings.length) {
    throw new TypeError(`${name} must not contain duplicates`);
  }
  return strings;
}

export function readHttpsUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${name} must be an absolute URL`);
  }
  if (url.protocol !== "https:") {
    throw new TypeError(`${name} must use https`);
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new TypeError(`${name} must not contain credentials`);
  }
  return url.toString();
}

export function readIssuerUrl(value: string): string {
  readHttpsUrl(value, "issuer");
  const url = new URL(value);
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new TypeError("issuer must not contain a query or fragment");
  }
  return value;
}

export function readRelativeEndpoint(value: string, name: string): string {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new TypeError(`${name} must be an issuer-relative path without query or fragment`);
  }
  return value;
}

export function readJsonObject(value: unknown, name: string): AgentAuthProtocolJsonObject {
  const object = readObject(value, name);
  const parsed: AgentAuthProtocolJsonObject = {};
  for (const [key, item] of Object.entries(object)) {
    parsed[key] = parseJsonValue(item, `${name}.${key}`);
  }
  return parsed;
}

function parseJsonValue(value: unknown, name: string): AgentAuthProtocolJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} must be finite`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => parseJsonValue(item, `${name}[${index}]`));
  }
  const object = readObject(value, name);
  const parsed: AgentAuthProtocolJsonObject = {};
  for (const [key, item] of Object.entries(object)) {
    parsed[key] = parseJsonValue(item, `${name}.${key}`);
  }
  return parsed;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
