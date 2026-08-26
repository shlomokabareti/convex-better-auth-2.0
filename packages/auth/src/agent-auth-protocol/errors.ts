import {
  type AgentAuthProtocolJsonObject,
  readJsonObject,
  readObject,
  readRequiredString,
} from "./shared";

export const AGENT_AUTH_PROTOCOL_ERROR_HTTP_STATUS = {
  invalid_request: 400,
  unknown_constraint_operator: 400,
  invalid_jwt: 401,
  agent_revoked: 403,
  agent_expired: 403,
  absolute_lifetime_exceeded: 403,
  agent_pending: 403,
  host_revoked: 403,
  host_pending: 403,
  unauthorized: 403,
  unsupported_mode: 400,
  unsupported_algorithm: 400,
  invalid_capabilities: 400,
  agent_exists: 409,
  already_granted: 409,
  capability_not_granted: 403,
  constraint_violated: 403,
  limit_exceeded: 403,
  agent_not_found: 404,
  agent_rejected: 403,
  agent_claimed: 403,
  host_not_found: 404,
  authentication_required: 401,
  capability_not_found: 404,
  authorization_pending: 400,
  slow_down: 400,
  access_denied: 403,
  rate_limited: 429,
  internal_error: 500,
} as const;

export type AgentAuthProtocolErrorCode = keyof typeof AGENT_AUTH_PROTOCOL_ERROR_HTTP_STATUS;

export type AgentAuthProtocolErrorResponse = AgentAuthProtocolJsonObject & {
  error: string;
  message: string;
};

const ERROR_CODE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export function createAgentAuthProtocolErrorResponse(args: {
  error: AgentAuthProtocolErrorCode;
  message: string;
  extensions?: AgentAuthProtocolJsonObject;
}): AgentAuthProtocolErrorResponse {
  const message = requireNonEmptyMessage(args.message);
  const extensions =
    args.extensions === undefined ? {} : readJsonObject(args.extensions, "error extensions");
  if ("error" in extensions || "message" in extensions) {
    throw new TypeError("error extensions must not override error or message");
  }
  return {
    error: args.error,
    message,
    ...extensions,
  };
}

export function parseAgentAuthProtocolErrorResponse(
  value: unknown,
): AgentAuthProtocolErrorResponse {
  const object = readObject(value, "Agent Auth error response");
  const error = readRequiredString(object, "error");
  if (!ERROR_CODE_PATTERN.test(error)) {
    throw new TypeError("error must be a snake_case machine-readable code");
  }
  const message = requireNonEmptyMessage(readRequiredString(object, "message"));
  const parsed = readJsonObject(object, "Agent Auth error response");
  return { ...parsed, error, message };
}

export function resolveAgentAuthProtocolErrorHttpStatus(error: string): number | undefined {
  return isAgentAuthProtocolErrorCode(error)
    ? AGENT_AUTH_PROTOCOL_ERROR_HTTP_STATUS[error]
    : undefined;
}

function requireNonEmptyMessage(value: string): string {
  if (value.trim().length === 0) {
    throw new TypeError("message must be non-empty");
  }
  return value;
}

function isAgentAuthProtocolErrorCode(value: string): value is AgentAuthProtocolErrorCode {
  return Object.prototype.hasOwnProperty.call(AGENT_AUTH_PROTOCOL_ERROR_HTTP_STATUS, value);
}
