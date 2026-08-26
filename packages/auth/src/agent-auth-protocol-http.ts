import {
  AGENT_AUTH_PROTOCOL_DISCOVERY_CACHE_CONTROL,
  AGENT_AUTH_PROTOCOL_DISCOVERY_PATH,
  AGENT_AUTH_PROTOCOL_VERSION,
  createAgentAuthDeviceAuthorizationChallenge,
  createAgentAuthProtocolDiscoveryDocument,
  createAgentAuthProtocolErrorResponse,
  hashAgentAuthDeviceAuthorizationCode,
  parseAgentAuthProtocolPublicEd25519Jwk,
  resolveAgentAuthProtocolErrorHttpStatus,
  type AgentAuthProtocolDiscoveryDocument,
  type AgentAuthProtocolJsonObject,
  type AgentAuthProtocolMode,
} from "./agent-auth-protocol";
import {
  resolveAgentAuthProtocolAgentPrincipal,
  resolveAgentAuthProtocolHostRequest,
  type AgentAuthProtocolAgentAuthorityAdapter,
  type AgentAuthProtocolHostRequestAuthorityAdapter,
} from "./agent-auth-protocol-convex";

type AgentPrincipal = Awaited<
  ReturnType<typeof resolveAgentAuthProtocolAgentPrincipal>
>;

export const AGENT_AUTH_PROTOCOL_V1_ENDPOINTS = {
  register: "/agent/register",
  capabilities: "/capability/list",
  describe_capability: "/capability/describe",
  execute: "/capability/execute",
  request_capability: "/agent/request-capability",
  status: "/agent/status",
  reactivate: "/agent/reactivate",
  revoke: "/agent/revoke",
  revoke_host: "/host/revoke",
  rotate_key: "/agent/rotate-key",
  rotate_host_key: "/host/rotate-key",
  introspect: "/agent/introspect",
} as const;

export type AgentAuthProtocolHttpMethod = "GET" | "POST";

export type AgentAuthProtocolHttpRoute<THandler> = {
  path: string;
  method: AgentAuthProtocolHttpMethod;
  handler: THandler;
};

export type AgentAuthProtocolCapabilityDefinition =
  AgentAuthProtocolJsonObject & {
    name: string;
  };

export type AgentAuthProtocolRequestedGrant = {
  capability: string;
  constraintsJson?: string;
  expiresAt?: number;
};

export type AgentAuthProtocolHttpAuthority<TContext> = {
  host(ctx: TContext): AgentAuthProtocolHostRequestAuthorityAdapter;
  agent(ctx: TContext): AgentAuthProtocolAgentAuthorityAdapter;
  registerAgent(
    ctx: TContext,
    input: {
      hostId: string;
      organizationId: string;
      name: string;
      mode: AgentAuthProtocolMode;
      delegatedUserId?: string;
      publicJwkJson: string;
      permissions: string[];
      requestedGrants: AgentAuthProtocolRequestedGrant[];
      deviceAuthorization: {
        userCodeHash: string;
        deviceCodeHash: string;
        expiresAt: number;
        pollIntervalSeconds: number;
      };
    }
  ): Promise<{ agentId: string; authorizationId: string }>;
  pollDeviceAuthorization(
    ctx: TContext,
    input: { deviceCodeHash: string }
  ): Promise<AgentAuthProtocolJsonObject>;
  getAgentStatus(
    ctx: TContext,
    input: { agentId: string; organizationId: string }
  ): Promise<AgentAuthProtocolJsonObject | null>;
  reactivateAgent(
    ctx: TContext,
    input: {
      hostId: string;
      agentId: string;
      organizationId: string;
      expiresAt: number;
    }
  ): Promise<AgentAuthProtocolJsonObject>;
  revokeAgent(
    ctx: TContext,
    input: { hostId: string; agentId: string; organizationId: string }
  ): Promise<AgentAuthProtocolJsonObject>;
  revokeHost(
    ctx: TContext,
    input: { hostId: string; organizationId: string }
  ): Promise<AgentAuthProtocolJsonObject>;
  rotateAgentKey(
    ctx: TContext,
    input: {
      agentId: string;
      organizationId: string;
      expectedGeneration: number;
      publicJwkJson: string;
    }
  ): Promise<AgentAuthProtocolJsonObject>;
  rotateHostKey(
    ctx: TContext,
    input: {
      hostId: string;
      organizationId: string;
      expectedGeneration: number;
      publicJwkJson: string;
    }
  ): Promise<AgentAuthProtocolJsonObject>;
  introspectAgent(
    ctx: TContext,
    input: {
      agentId: string;
      organizationId: string;
      claimedPermissions?: string[];
      claimedCapabilities?: string[];
    }
  ): Promise<AgentAuthProtocolJsonObject>;
};

export type CreateAgentAuthProtocolHttpServerConfig<TContext> = {
  issuer: string;
  providerName: string;
  description: string;
  verificationUri: string;
  modes?: AgentAuthProtocolMode[];
  authority: AgentAuthProtocolHttpAuthority<TContext>;
  capabilities: {
    list(
      ctx: TContext,
      input: {
        principal: AgentPrincipal;
        query?: string;
        cursor?: string;
        limit: number;
      }
    ): Promise<AgentAuthProtocolJsonObject>;
    describe(
      ctx: TContext,
      input: { principal: AgentPrincipal; capability: string }
    ): Promise<AgentAuthProtocolCapabilityDefinition | null>;
    request(
      ctx: TContext,
      input: {
        principal: AgentPrincipal;
        capabilities: AgentAuthProtocolRequestedGrant[];
        reason?: string;
      }
    ): Promise<AgentAuthProtocolJsonObject>;
    execute(
      ctx: TContext,
      input: {
        principal: AgentPrincipal;
        capability: string;
        arguments: AgentAuthProtocolJsonObject;
      }
    ): Promise<AgentAuthProtocolJsonObject>;
  };
};

export type AgentAuthProtocolHttpServer<TContext> = {
  discovery: AgentAuthProtocolDiscoveryDocument;
  handleHttpRequest(ctx: TContext, request: Request): Promise<Response>;
  registerHttpRoutes<THandler>(
    http: {
      route(spec: AgentAuthProtocolHttpRoute<THandler>): void;
    },
    handler: THandler
  ): void;
};

class ProtocolHttpError extends Error {
  constructor(
    readonly code: Parameters<
      typeof createAgentAuthProtocolErrorResponse
    >[0]["error"],
    message: string
  ) {
    super(message);
  }
}

export function createAgentAuthProtocolHttpServer<TContext>(
  config: CreateAgentAuthProtocolHttpServerConfig<TContext>
): AgentAuthProtocolHttpServer<TContext> {
  const issuer = normalizeIssuer(config.issuer);
  const verificationUri = normalizeHttpsUrl(
    config.verificationUri,
    "verificationUri"
  );
  const discovery = createAgentAuthProtocolDiscoveryDocument({
    provider_name: config.providerName,
    description: config.description,
    issuer,
    default_location: absoluteEndpoint(
      issuer,
      AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute
    ),
    modes: config.modes ?? ["delegated", "autonomous"],
    approval_methods: ["device_authorization"],
    endpoints: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS,
  });

  const handleHttpRequest = async (
    ctx: TContext,
    request: Request
  ): Promise<Response> => {
    try {
      return await dispatch(ctx, request, config, discovery, verificationUri);
    } catch (error) {
      if (error instanceof ProtocolHttpError) {
        return jsonResponse(
          resolveAgentAuthProtocolErrorHttpStatus(error.code) ?? 500,
          createAgentAuthProtocolErrorResponse({
            error: error.code,
            message: error.message,
          })
        );
      }
      const message =
        error instanceof Error ? error.message : "Agent Auth request failed";
      const code = classifyAuthorityError(message);
      return jsonResponse(
        resolveAgentAuthProtocolErrorHttpStatus(code) ?? 500,
        createAgentAuthProtocolErrorResponse({ error: code, message })
      );
    }
  };

  return {
    discovery,
    handleHttpRequest,
    registerHttpRoutes(http, handler) {
      for (const route of agentAuthProtocolHttpRoutes()) {
        http.route({ ...route, handler });
      }
    },
  };
}

export function agentAuthProtocolHttpRoutes(): ReadonlyArray<{
  path: string;
  method: AgentAuthProtocolHttpMethod;
}> {
  return [
    { path: AGENT_AUTH_PROTOCOL_DISCOVERY_PATH, method: "GET" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.capabilities, method: "GET" },
    {
      path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.describe_capability,
      method: "GET",
    },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.status, method: "GET" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.register, method: "POST" },
    {
      path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.request_capability,
      method: "POST",
    },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.reactivate, method: "POST" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.revoke, method: "POST" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.rotate_key, method: "POST" },
    {
      path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.rotate_host_key,
      method: "POST",
    },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.revoke_host, method: "POST" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute, method: "POST" },
    { path: AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.introspect, method: "POST" },
  ];
}

async function dispatch<TContext>(
  ctx: TContext,
  request: Request,
  config: CreateAgentAuthProtocolHttpServerConfig<TContext>,
  discovery: AgentAuthProtocolDiscoveryDocument,
  verificationUri: string
): Promise<Response> {
  const url = new URL(request.url);
  if (
    url.pathname === AGENT_AUTH_PROTOCOL_DISCOVERY_PATH &&
    request.method === "GET"
  ) {
    return jsonResponse(200, discovery, {
      cacheControl: AGENT_AUTH_PROTOCOL_DISCOVERY_CACHE_CONTROL,
    });
  }
  requireVersion(request);
  const endpoint = endpointForRequest(url.pathname, request.method);
  if (endpoint === null) {
    throw new ProtocolHttpError("invalid_request", "Protocol route not found");
  }
  const audience = absoluteEndpoint(discovery.issuer, url.pathname);

  if (endpoint === "register") {
    const body = await readJsonBody(request);
    const organizationId = requiredString(body, "organization_id");
    const resolved = await resolveAgentAuthProtocolHostRequest(
      config.authority.host(ctx),
      {
        token: bearerToken(request),
        audience,
        registration: true,
        requestedOrganizationId: organizationId,
      }
    );
    const agentPublicKey = resolved.verified.claims.agent_public_key;
    if (agentPublicKey === undefined) {
      throw new ProtocolHttpError(
        "invalid_request",
        "Convex registration requires an inline agent_public_key"
      );
    }
    const mode = readMode(body.mode);
    const challenge = await createAgentAuthDeviceAuthorizationChallenge();
    const registered = await config.authority.registerAgent(ctx, {
      hostId: resolved.authority.hostId,
      organizationId,
      name: requiredString(body, "name", 200),
      mode,
      ...(optionalString(body, "delegated_user_id") === undefined
        ? {}
        : { delegatedUserId: optionalString(body, "delegated_user_id") }),
      publicJwkJson: JSON.stringify(agentPublicKey),
      permissions: readStringArray(body.permissions, "permissions", 64),
      requestedGrants: readRequestedGrants(body.capabilities),
      deviceAuthorization: {
        userCodeHash: challenge.userCodeHash,
        deviceCodeHash: challenge.deviceCodeHash,
        expiresAt: challenge.expiresAt,
        pollIntervalSeconds: challenge.interval,
      },
    });
    const complete = new URL(verificationUri);
    complete.searchParams.set("user_code", challenge.userCode);
    return jsonResponse(201, {
      version: AGENT_AUTH_PROTOCOL_VERSION,
      agent_id: registered.agentId,
      host_id: resolved.authority.hostId,
      status: "pending",
      approval: {
        method: "device_authorization",
        verification_uri: verificationUri,
        verification_uri_complete: complete.toString(),
        user_code: challenge.userCode,
        device_code: challenge.deviceCode,
        expires_in: challenge.expiresIn,
        interval: challenge.interval,
      },
    });
  }

  if (endpoint === "status") {
    const deviceCode = url.searchParams.get("device_code");
    if (deviceCode !== null) {
      return jsonResponse(
        200,
        await config.authority.pollDeviceAuthorization(ctx, {
          deviceCodeHash:
            await hashAgentAuthDeviceAuthorizationCode(deviceCode),
        })
      );
    }
    const organizationId = requiredQuery(url, "organization_id");
    const agentId = requiredQuery(url, "agent_id");
    const host = await resolveAgentAuthProtocolHostRequest(
      config.authority.host(ctx),
      {
        token: bearerToken(request),
        audience,
        registration: false,
        requestedOrganizationId: organizationId,
      }
    );
    const status = await config.authority.getAgentStatus(ctx, {
      agentId,
      organizationId,
    });
    if (status === null || status.hostId !== host.authority.hostId) {
      throw new ProtocolHttpError("agent_not_found", "Agent not found");
    }
    return jsonResponse(200, status);
  }

  if (
    endpoint === "reactivate" ||
    endpoint === "revoke" ||
    endpoint === "revoke_host" ||
    endpoint === "rotate_host_key"
  ) {
    const body = await readJsonBody(request);
    const organizationId = requiredString(body, "organization_id");
    const host = await resolveAgentAuthProtocolHostRequest(
      config.authority.host(ctx),
      {
        token: bearerToken(request),
        audience,
        registration: false,
        requestedOrganizationId: organizationId,
      }
    );
    if (endpoint === "revoke_host") {
      return jsonResponse(
        200,
        await config.authority.revokeHost(ctx, {
          hostId: host.authority.hostId,
          organizationId,
        })
      );
    }
    if (endpoint === "rotate_host_key") {
      return jsonResponse(
        200,
        await config.authority.rotateHostKey(ctx, {
          hostId: host.authority.hostId,
          organizationId,
          expectedGeneration: requiredInteger(body, "expected_generation"),
          publicJwkJson: JSON.stringify(
            parseAgentAuthProtocolPublicEd25519Jwk(body.public_key)
          ),
        })
      );
    }
    const agentId = requiredString(body, "agent_id");
    const input = {
      hostId: host.authority.hostId,
      agentId,
      organizationId,
    };
    return jsonResponse(
      200,
      endpoint === "reactivate"
        ? await config.authority.reactivateAgent(ctx, {
            ...input,
            expiresAt: requiredInteger(body, "expires_at"),
          })
        : await config.authority.revokeAgent(ctx, input)
    );
  }

  const body =
    request.method === "POST" ? await readJsonBody(request) : undefined;
  const organizationId =
    body === undefined
      ? requiredQuery(url, "organization_id")
      : requiredString(body, "organization_id");
  const principal = await resolveAgentAuthProtocolAgentPrincipal(
    config.authority.agent(ctx),
    {
      token: bearerToken(request),
      audience,
      requestedOrganizationId: organizationId,
    }
  );
  const authenticatedBody = body ?? {};

  switch (endpoint) {
    case "capabilities":
      return jsonResponse(
        200,
        await config.capabilities.list(ctx, {
          principal,
          ...(optionalQuery(url, "query") === undefined
            ? {}
            : { query: optionalQuery(url, "query") }),
          ...(optionalQuery(url, "cursor") === undefined
            ? {}
            : { cursor: optionalQuery(url, "cursor") }),
          limit: readLimit(url.searchParams.get("limit")),
        })
      );
    case "describe_capability": {
      const capability = requiredQuery(url, "capability");
      const definition = await config.capabilities.describe(ctx, {
        principal,
        capability,
      });
      if (definition === null) {
        throw new ProtocolHttpError(
          "capability_not_found",
          "Capability not found"
        );
      }
      return jsonResponse(200, definition);
    }
    case "execute":
      return jsonResponse(
        200,
        await config.capabilities.execute(ctx, {
          principal,
          capability: requiredString(authenticatedBody, "capability"),
          arguments: readJsonObject(authenticatedBody.arguments, "arguments"),
        })
      );
    case "request_capability":
      return jsonResponse(
        200,
        await config.capabilities.request(ctx, {
          principal,
          capabilities: readRequestedGrants(authenticatedBody.capabilities),
          ...(optionalString(authenticatedBody, "reason", 1_000) === undefined
            ? {}
            : {
                reason: optionalString(authenticatedBody, "reason", 1_000),
              }),
        })
      );
    case "rotate_key":
      return jsonResponse(
        200,
        await config.authority.rotateAgentKey(ctx, {
          agentId: principal.agentId,
          organizationId,
          expectedGeneration: requiredInteger(
            authenticatedBody,
            "expected_generation"
          ),
          publicJwkJson: JSON.stringify(
            parseAgentAuthProtocolPublicEd25519Jwk(authenticatedBody.public_key)
          ),
        })
      );
    case "introspect":
      return jsonResponse(
        200,
        await config.authority.introspectAgent(ctx, {
          agentId: principal.agentId,
          organizationId,
          ...(authenticatedBody.permissions === undefined
            ? {}
            : {
                claimedPermissions: readStringArray(
                  authenticatedBody.permissions,
                  "permissions",
                  64
                ),
              }),
          ...(authenticatedBody.capabilities === undefined
            ? {}
            : {
                claimedCapabilities: readStringArray(
                  authenticatedBody.capabilities,
                  "capabilities",
                  64
                ),
              }),
        })
      );
    default:
      throw new ProtocolHttpError(
        "invalid_request",
        "Protocol route is not implemented"
      );
  }
}

function endpointForRequest(
  path: string,
  method: string
): keyof typeof AGENT_AUTH_PROTOCOL_V1_ENDPOINTS | null {
  if (
    path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.capabilities &&
    method === "GET"
  )
    return "capabilities";
  if (
    path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.describe_capability &&
    method === "GET"
  )
    return "describe_capability";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.status && method === "GET")
    return "status";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.register && method === "POST")
    return "register";
  if (
    path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.request_capability &&
    method === "POST"
  )
    return "request_capability";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.reactivate && method === "POST")
    return "reactivate";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.revoke && method === "POST")
    return "revoke";
  if (
    path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.revoke_host &&
    method === "POST"
  )
    return "revoke_host";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.rotate_key && method === "POST")
    return "rotate_key";
  if (
    path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.rotate_host_key &&
    method === "POST"
  )
    return "rotate_host_key";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute && method === "POST")
    return "execute";
  if (path === AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.introspect && method === "POST")
    return "introspect";
  return null;
}

function requireVersion(request: Request): void {
  const value = request.headers.get("agent-auth-version");
  if (value !== AGENT_AUTH_PROTOCOL_VERSION) {
    throw new ProtocolHttpError(
      "invalid_request",
      `agent-auth-version must be ${AGENT_AUTH_PROTOCOL_VERSION}`
    );
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer ([^\s]+)$/iu.exec(header);
  if (match?.[1] === undefined || match[1].split(".").length !== 3) {
    throw new ProtocolHttpError(
      "authentication_required",
      "Bearer Agent Auth Protocol credential required"
    );
  }
  return match[1];
}

async function readJsonBody(
  request: Request
): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64_000) {
    throw new ProtocolHttpError("limit_exceeded", "Request body is too large");
  }
  try {
    return readJsonObject(await request.json(), "request body");
  } catch (error) {
    if (error instanceof ProtocolHttpError) throw error;
    throw new ProtocolHttpError(
      "invalid_request",
      "Request body must be a JSON object"
    );
  }
}

function readJsonObject(
  value: unknown,
  name: string
): AgentAuthProtocolJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProtocolHttpError("invalid_request", `${name} must be an object`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      readJsonValue(item, `${name}.${key}`),
    ])
  );
}

function readJsonValue(
  value: unknown,
  name: string
): AgentAuthProtocolJsonObject[string] {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ProtocolHttpError("invalid_request", `${name} must be finite`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => readJsonValue(item, `${name}[${index}]`));
  }
  return readJsonObject(value, name);
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
  maximum = 256
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new ProtocolHttpError("invalid_request", `${key} is required`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new ProtocolHttpError("invalid_request", `${key} is invalid`);
  }
  return normalized;
}

function optionalString(
  object: Record<string, unknown>,
  key: string,
  maximum = 256
): string | undefined {
  return object[key] === undefined
    ? undefined
    : requiredString(object, key, maximum);
}

function requiredInteger(object: Record<string, unknown>, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new ProtocolHttpError(
      "invalid_request",
      `${key} must be a safe integer`
    );
  }
  return value;
}

function readMode(value: unknown): AgentAuthProtocolMode {
  if (value === "delegated" || value === "autonomous") return value;
  throw new ProtocolHttpError("unsupported_mode", "Unsupported agent mode");
}

function readStringArray(
  value: unknown,
  name: string,
  maximum: number
): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new ProtocolHttpError("invalid_request", `${name} is invalid`);
  }
  const values = value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new ProtocolHttpError("invalid_request", `${name} is invalid`);
    }
    return item.trim();
  });
  if (new Set(values).size !== values.length) {
    throw new ProtocolHttpError(
      "invalid_request",
      `${name} must not contain duplicates`
    );
  }
  return values;
}

function readRequestedGrants(
  value: unknown
): AgentAuthProtocolRequestedGrant[] {
  if (!Array.isArray(value) || value.length > 64) {
    throw new ProtocolHttpError(
      "invalid_capabilities",
      "capabilities must be an array of at most 64 grants"
    );
  }
  return value.map((item) => {
    if (typeof item === "string") {
      return { capability: requiredString({ capability: item }, "capability") };
    }
    const object = readJsonObject(item, "capability");
    const constraints =
      object.constraints === undefined
        ? undefined
        : JSON.stringify(readJsonObject(object.constraints, "constraints"));
    if (constraints !== undefined && constraints.length > 16_000) {
      throw new ProtocolHttpError(
        "limit_exceeded",
        "Capability constraints are too large"
      );
    }
    const expiresAt =
      object.expires_at === undefined
        ? undefined
        : requiredInteger(object, "expires_at");
    return {
      capability: requiredString(object, "name"),
      ...(constraints === undefined ? {} : { constraintsJson: constraints }),
      ...(expiresAt === undefined ? {} : { expiresAt }),
    };
  });
}

function requiredQuery(url: URL, name: string): string {
  const value = optionalQuery(url, name);
  if (value === undefined) {
    throw new ProtocolHttpError(
      "invalid_request",
      `${name} query parameter is required`
    );
  }
  return value;
}

function optionalQuery(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  if (value === undefined || value.length === 0) return undefined;
  if (value.length > 512) {
    throw new ProtocolHttpError("invalid_request", `${name} is too long`);
  }
  return value;
}

function readLimit(value: string | null): number {
  if (value === null) return 50;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ProtocolHttpError(
      "invalid_request",
      "limit must be an integer between 1 and 100"
    );
  }
  return limit;
}

function normalizeIssuer(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new TypeError("issuer must be an HTTPS origin");
  }
  return url.origin;
}

function normalizeHttpsUrl(value: string, name: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new TypeError(`${name} must be an HTTPS URL`);
  }
  return url.toString();
}

function absoluteEndpoint(issuer: string, path: string): string {
  return new URL(path, `${issuer}/`).toString();
}

function jsonResponse(
  status: number,
  body: unknown,
  options?: { cacheControl?: string }
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": options?.cacheControl ?? "no-store",
    },
  });
}

function classifyAuthorityError(
  message: string
): Parameters<typeof createAgentAuthProtocolErrorResponse>[0]["error"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("replay")) return "invalid_jwt";
  if (normalized.includes("expired")) return "agent_expired";
  if (normalized.includes("host") && normalized.includes("revoked")) {
    return "host_revoked";
  }
  if (normalized.includes("agent") && normalized.includes("revoked")) {
    return "agent_revoked";
  }
  if (normalized.includes("organization mismatch")) return "unauthorized";
  if (
    normalized.includes("credential") ||
    normalized.includes("jwt") ||
    normalized.includes("signature") ||
    normalized.includes("authority")
  ) {
    return "invalid_jwt";
  }
  return "internal_error";
}
