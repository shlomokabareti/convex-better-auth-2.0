import {
  readHttpsUrl,
  readIssuerUrl,
  readObject,
  readRelativeEndpoint,
  readRequiredString,
  readStringArray,
} from "./shared";

export const AGENT_AUTH_PROTOCOL_VERSION = "1.0-draft" as const;
export const AGENT_AUTH_PROTOCOL_SUPPORTED_MAJOR_VERSION = 1 as const;
export const AGENT_AUTH_PROTOCOL_DISCOVERY_PATH =
  "/.well-known/agent-configuration" as const;
export const AGENT_AUTH_PROTOCOL_DISCOVERY_CACHE_CONTROL =
  "public, max-age=3600" as const;

export const AGENT_AUTH_PROTOCOL_ENDPOINT_NAMES = [
  "register",
  "capabilities",
  "describe_capability",
  "execute",
  "request_capability",
  "status",
  "reactivate",
  "revoke",
  "revoke_host",
  "rotate_key",
  "rotate_host_key",
  "introspect",
] as const;

export type AgentAuthProtocolEndpointName =
  (typeof AGENT_AUTH_PROTOCOL_ENDPOINT_NAMES)[number];
export type AgentAuthProtocolMode = "delegated" | "autonomous";
export type AgentAuthProtocolAlgorithm = "Ed25519";
export type AgentAuthProtocolApprovalMethod =
  | "device_authorization"
  | "ciba"
  | (string & {});

export type AgentAuthProtocolEndpoints = Record<
  AgentAuthProtocolEndpointName,
  string
>;

export type AgentAuthProtocolDiscoveryDocument = {
  version: typeof AGENT_AUTH_PROTOCOL_VERSION;
  provider_name: string;
  description: string;
  issuer: string;
  default_location?: string;
  algorithms: AgentAuthProtocolAlgorithm[];
  modes: AgentAuthProtocolMode[];
  approval_methods: AgentAuthProtocolApprovalMethod[];
  endpoints: AgentAuthProtocolEndpoints;
  jwks_uri?: string;
};

export type CreateAgentAuthProtocolDiscoveryDocumentArgs = Omit<
  AgentAuthProtocolDiscoveryDocument,
  "algorithms" | "version"
>;

export type ParsedAgentAuthProtocolVersion = {
  raw: string;
  major: number;
  minor: number;
  draft: boolean;
};

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(-draft)?$/;
export function parseAgentAuthProtocolVersion(
  value: unknown
): ParsedAgentAuthProtocolVersion {
  if (typeof value !== "string") {
    throw new TypeError("version must be a string");
  }
  const match = VERSION_PATTERN.exec(value);
  if (match === null) {
    throw new TypeError("version must use MAJOR.MINOR or MAJOR.MINOR-draft");
  }
  const majorRaw = match[1];
  const minorRaw = match[2];
  if (majorRaw === undefined || minorRaw === undefined) {
    throw new TypeError("version captures are missing");
  }
  return {
    raw: value,
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
    draft: match[3] === "-draft",
  };
}

export function assertSupportedAgentAuthProtocolVersion(
  value: unknown
): typeof AGENT_AUTH_PROTOCOL_VERSION {
  const parsed = parseAgentAuthProtocolVersion(value);
  if (parsed.major !== AGENT_AUTH_PROTOCOL_SUPPORTED_MAJOR_VERSION) {
    throw new RangeError(
      `Unsupported Agent Auth Protocol major version ${parsed.major}`
    );
  }
  if (parsed.raw !== AGENT_AUTH_PROTOCOL_VERSION) {
    throw new RangeError(
      `Unsupported Agent Auth Protocol draft ${parsed.raw}; expected ${AGENT_AUTH_PROTOCOL_VERSION}`
    );
  }
  return AGENT_AUTH_PROTOCOL_VERSION;
}

export function createAgentAuthProtocolDiscoveryDocument(
  args: CreateAgentAuthProtocolDiscoveryDocumentArgs
): AgentAuthProtocolDiscoveryDocument {
  return parseAgentAuthProtocolDiscoveryDocument({
    ...args,
    version: AGENT_AUTH_PROTOCOL_VERSION,
    algorithms: ["Ed25519"],
  });
}

export function parseAgentAuthProtocolDiscoveryDocument(
  value: unknown
): AgentAuthProtocolDiscoveryDocument {
  const object = readObject(value, "Agent Auth discovery document");
  const version = assertSupportedAgentAuthProtocolVersion(object.version);
  const providerName = readRequiredString(object, "provider_name");
  const description = readRequiredString(object, "description");
  const issuer = readIssuerUrl(readRequiredString(object, "issuer"));
  const algorithms = readAlgorithms(object.algorithms);
  const modes = readModes(object.modes);
  const approvalMethods = readApprovalMethods(object.approval_methods);
  const endpoints = readEndpoints(object.endpoints);
  const defaultLocationRaw = object.default_location;
  const jwksUriRaw = object.jwks_uri;
  const defaultLocation =
    defaultLocationRaw === undefined
      ? undefined
      : readHttpsUrl(
          readRequiredString(object, "default_location"),
          "default_location"
        );
  const jwksUri =
    jwksUriRaw === undefined
      ? undefined
      : readHttpsUrl(readRequiredString(object, "jwks_uri"), "jwks_uri");

  return {
    version,
    provider_name: providerName,
    description,
    issuer,
    ...(defaultLocation === undefined
      ? {}
      : { default_location: defaultLocation }),
    algorithms,
    modes,
    approval_methods: approvalMethods,
    endpoints,
    ...(jwksUri === undefined ? {} : { jwks_uri: jwksUri }),
  };
}

export function resolveAgentAuthProtocolDefaultLocation(
  document: AgentAuthProtocolDiscoveryDocument
): string {
  return (
    document.default_location ??
    new URL(document.endpoints.execute, `${document.issuer}/`).toString()
  );
}

function readAlgorithms(value: unknown): AgentAuthProtocolAlgorithm[] {
  const algorithms = readStringArray(value, "algorithms", {
    allowEmpty: false,
  });
  if (algorithms.length !== 1 || algorithms[0] !== "Ed25519") {
    throw new TypeError(
      "algorithms must contain only Ed25519 for Agent Auth Protocol v1.0-draft"
    );
  }
  return ["Ed25519"];
}

function readModes(value: unknown): AgentAuthProtocolMode[] {
  return readStringArray(value, "modes", { allowEmpty: false }).map((mode) => {
    if (!isAgentAuthProtocolMode(mode)) {
      throw new TypeError(`Unsupported Agent Auth mode ${mode}`);
    }
    return mode;
  });
}

function readApprovalMethods(
  value: unknown
): AgentAuthProtocolApprovalMethod[] {
  const methods = readStringArray(value, "approval_methods", {
    allowEmpty: false,
  });
  if (!methods.includes("device_authorization")) {
    throw new TypeError(
      "approval_methods must include device_authorization for the declared v1.0-draft profile"
    );
  }
  return methods;
}

function readEndpoints(value: unknown): AgentAuthProtocolEndpoints {
  const object = readObject(value, "endpoints");
  const read = (name: AgentAuthProtocolEndpointName): string =>
    readRelativeEndpoint(readRequiredString(object, name), `endpoints.${name}`);
  return {
    register: read("register"),
    capabilities: read("capabilities"),
    describe_capability: read("describe_capability"),
    execute: read("execute"),
    request_capability: read("request_capability"),
    status: read("status"),
    reactivate: read("reactivate"),
    revoke: read("revoke"),
    revoke_host: read("revoke_host"),
    rotate_key: read("rotate_key"),
    rotate_host_key: read("rotate_host_key"),
    introspect: read("introspect"),
  };
}

function isAgentAuthProtocolMode(
  value: string
): value is AgentAuthProtocolMode {
  return value === "delegated" || value === "autonomous";
}
