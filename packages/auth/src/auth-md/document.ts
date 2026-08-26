import type { AuthMdDiscoveryDocuments, AuthMdIdentityType } from "./discovery";

export type CreateAuthMdDocumentArgs = {
  serviceName: string;
  description: string;
  discovery: AuthMdDiscoveryDocuments;
  scopeDescriptions: Readonly<Record<string, string>>;
  pricingUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  contact: string;
};

export function createAuthMdDocument(args: CreateAuthMdDocumentArgs): string {
  const serviceName = readMarkdownText(args.serviceName, "serviceName");
  const description = readMarkdownText(args.description, "description");
  const contact = readMarkdownText(args.contact, "contact");
  const metadata = args.discovery.authorizationServer;
  const protectedResourceUrl = `${new URL(metadata.resource).origin}/.well-known/oauth-protected-resource`;
  const authorizationServerMetadataUrl = `${new URL(metadata.issuer).origin}/.well-known/oauth-authorization-server`;
  const scopeLines = metadata.scopes_supported.map((scope) => {
    const descriptionValue = args.scopeDescriptions[scope];
    const scopeDescription = readMarkdownText(descriptionValue, `scopeDescriptions.${scope}`);
    return `- \`${scope}\` — ${scopeDescription}`;
  });
  const flowLines = metadata.agent_auth.identity_types_supported.map(
    (identityType) => `- \`${identityType}\` — ${describeIdentityType(identityType)}`,
  );
  const policyLines = [
    renderPolicyLink("Pricing", args.pricingUrl),
    renderPolicyLink("Terms", args.termsUrl),
    renderPolicyLink("Privacy", args.privacyUrl),
  ].filter((line): line is string => line !== undefined);

  return [
    `# ${serviceName} agent authentication`,
    "",
    description,
    "",
    "## Discovery",
    "",
    `- Protected resource metadata: ${protectedResourceUrl}`,
    `- Authorization server metadata: ${authorizationServerMetadataUrl}`,
    `- Agent identity endpoint: ${metadata.agent_auth.identity_endpoint}`,
    `- Claim endpoint: ${metadata.agent_auth.claim_endpoint}`,
    `- Token endpoint: ${metadata.token_endpoint}`,
    `- Revocation endpoint: ${metadata.revocation_endpoint}`,
    "",
    "The structured metadata is authoritative. This document is its human-readable summary.",
    "",
    "## Supported registration types",
    "",
    ...flowLines,
    "",
    "Credentials are issued only after the advertised registration and claim flow completes.",
    "",
    "## Scopes",
    "",
    ...scopeLines,
    ...(policyLines.length === 0 ? [] : ["", "## Policies", "", ...policyLines]),
    "",
    "## Integration contact",
    "",
    contact,
    "",
  ].join("\n");
}

function describeIdentityType(identityType: AuthMdIdentityType): string {
  switch (identityType) {
    case "service_auth":
      return "the user signs in to this service and confirms the code supplied by the agent";
    case "identity_assertion":
      return "a trusted provider supplies an audience-bound ID-JAG; first-link confirmation may still be required";
    case "anonymous":
      return "the service may issue explicitly limited pre-claim access before a user takes ownership";
    default:
      return unreachableIdentityType(identityType);
  }
}

function unreachableIdentityType(value: never): never {
  throw new TypeError(`Unsupported auth.md identity type ${String(value)}`);
}

function renderPolicyLink(label: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const url = readHttpsUrl(value, label);
  return `- ${label}: ${url}`;
}

function readHttpsUrl(value: string, name: string): string {
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

function readMarkdownText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.includes("\n") || normalized.includes("\r")) {
    throw new TypeError(`${name} must be a single line`);
  }
  return escapeMarkdownInline(normalized);
}

function escapeMarkdownInline(value: string): string {
  let escaped = "";
  for (const character of value) {
    escaped += MARKDOWN_INLINE_SPECIAL_CHARACTERS.has(character) ? `\\${character}` : character;
  }
  return escaped;
}

const MARKDOWN_INLINE_SPECIAL_CHARACTERS = new Set([
  "\\",
  "`",
  "*",
  "_",
  "{",
  "}",
  "[",
  "]",
  "<",
  ">",
  "#",
  "|",
]);
