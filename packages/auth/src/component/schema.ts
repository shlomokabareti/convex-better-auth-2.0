import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  organization_invitations,
  organization_members,
  organization_roles,
  organizations,
} from "./schema/organizations.js";

export const organizationStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("deleted"),
);

export const organizationMemberStatusValidator = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("suspended"),
);

export const organizationInvitationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
);

export const invitationEmailDeliveryStatusValidator = v.union(
  v.literal("not_configured"),
  v.literal("queued"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("delivery_delayed"),
  v.literal("bounced"),
  v.literal("failed"),
);

export const emailTwoFactorStatusValidator = v.union(
  v.literal("disabled"),
  v.literal("enabled"),
  v.literal("reset_required"),
);

export const emailTwoFactorResetReasonValidator = v.union(
  v.literal("missing_email"),
  v.literal("email_not_verified"),
  v.literal("email_changed"),
);

export const apiKeyStatusValidator = v.union(v.literal("active"), v.literal("revoked"));
/**
 * Sandbox vs production is deliberately a TYPED COLUMN, not a scope string or metadata.
 *
 * better-auth's api-key plugin would carry this in free-form `metadata`, and that is the
 * one place we diverge from it: this field decides whether a request moves real money, so
 * it must be indexable and impossible to typo. A key issued for sandbox must never
 * authenticate a production request.
 */
export const apiKeyEnvironmentValidator = v.union(v.literal("sandbox"), v.literal("production"));
export const apiKeyOwnerTypeValidator = v.union(
  v.literal("user"),
  v.literal("organization"),
  v.literal("service"),
);
export const servicePrincipalStatusValidator = v.union(v.literal("active"), v.literal("disabled"));

export const agentModeValidator = v.union(v.literal("delegated"), v.literal("autonomous"));

export const agentHostStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("revoked"),
  v.literal("rejected"),
);

export const agentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("revoked"),
  v.literal("rejected"),
);

export const agentKeyStatusValidator = v.union(
  v.literal("active"),
  v.literal("rotated"),
  v.literal("revoked"),
);

export const agentCapabilityGrantStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("denied"),
  v.literal("revoked"),
);

export const agentDeviceAuthorizationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("expired"),
);

export const agentAuthAuditActorTypeValidator = v.union(
  v.literal("user"),
  v.literal("host"),
  v.literal("agent"),
  v.literal("system"),
);

export const authMdRegistrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("claimed"),
  v.literal("expired"),
  v.literal("revoked"),
);

export const authMdAssertionStatusValidator = v.union(
  v.literal("active"),
  v.literal("consumed"),
  v.literal("revoked"),
);

export const authMdCredentialStatusValidator = v.union(v.literal("active"), v.literal("revoked"));

export const verificationCodeTypeValidator = v.union(
  v.literal("email_verification"),
  v.literal("password_reset"),
  v.literal("email_change"),
  v.literal("two_factor_pending"),
  v.literal("two_factor_trusted_device"),
);

export const authMdAuditActorTypeValidator = v.union(
  v.literal("external"),
  v.literal("user"),
  v.literal("credential"),
  v.literal("system"),
);

export const authAuditActorTypeValidator = v.union(
  v.literal("anonymous"),
  v.literal("user"),
  v.literal("machine"),
  v.literal("service"),
  v.literal("system"),
);

export const webhookEndpointStatusValidator = v.union(
  v.literal("active"),
  v.literal("disabled"),
  v.literal("archived"),
);

export const webhookDeliveryStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("delivered"),
  v.literal("failed"),
);

export const webhookFailureKindValidator = v.union(
  v.literal("endpoint_inactive"),
  v.literal("network_error"),
  v.literal("rate_limited"),
  v.literal("server_error"),
  v.literal("client_error"),
  v.literal("unknown_error"),
);

export default defineSchema({
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.boolean(),
    emailTwoFactorStatus: v.optional(emailTwoFactorStatusValidator),
    emailTwoFactorEmail: v.optional(v.string()),
    emailTwoFactorEnabledAt: v.optional(v.number()),
    emailTwoFactorDisabledAt: v.optional(v.number()),
    emailTwoFactorLastVerifiedAt: v.optional(v.number()),
    emailTwoFactorResetAt: v.optional(v.number()),
    emailTwoFactorResetReason: v.optional(emailTwoFactorResetReasonValidator),
    twoFactorEnabled: v.optional(v.boolean()),
    twoFactorSecret: v.optional(v.string()),
    twoFactorBackupCodes: v.optional(v.array(v.string())),
    activeOrganizationId: v.optional(v.id("organizations")),
    isActive: v.boolean(),
    isSuperAdmin: v.optional(v.boolean()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_active_organization", ["activeOrganizationId"]),

  auth_identities: defineTable({
    identityId: v.string(),
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    emailVerified: v.boolean(),
    sessionId: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identity_id", ["identityId"])
    .index("by_provider_issuer_subject", ["provider", "issuer", "subject"])
    .index("by_issuer_subject", ["issuer", "subject"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_user", ["userId"])
    .index("by_user_provider_issuer", ["userId", "provider", "issuer"]),

  organizations,
  organization_roles,
  organization_members,
  organization_invitations,

  service_principals: defineTable({
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: servicePrincipalStatusValidator,
    organizationId: v.optional(v.id("organizations")),
    permissions: v.array(v.string()),
    metadataJson: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"]),

  agent_hosts: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    status: agentHostStatusValidator,
    activeKeyGeneration: v.number(),
    activatedBy: v.optional(v.id("users")),
    activatedAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    cascadeCompletedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"]),

  agent_host_keys: defineTable({
    hostId: v.id("agent_hosts"),
    generation: v.number(),
    thumbprint: v.string(),
    publicJwkJson: v.string(),
    status: agentKeyStatusValidator,
    createdAt: v.number(),
    retiredAt: v.optional(v.number()),
  })
    .index("by_host_generation", ["hostId", "generation"])
    .index("by_thumbprint", ["thumbprint"]),

  agents: defineTable({
    organizationId: v.id("organizations"),
    hostId: v.id("agent_hosts"),
    name: v.string(),
    mode: agentModeValidator,
    status: agentStatusValidator,
    delegatedUserId: v.optional(v.id("users")),
    permissions: v.array(v.string()),
    activeKeyGeneration: v.number(),
    activatedBy: v.optional(v.id("users")),
    activatedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    absoluteExpiresAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_host", ["hostId"])
    .index("by_host_status", ["hostId", "status"]),

  agent_keys: defineTable({
    agentId: v.id("agents"),
    generation: v.number(),
    thumbprint: v.string(),
    publicJwkJson: v.string(),
    status: agentKeyStatusValidator,
    createdAt: v.number(),
    retiredAt: v.optional(v.number()),
  })
    .index("by_agent_generation", ["agentId", "generation"])
    .index("by_thumbprint", ["thumbprint"]),

  agent_capability_grants: defineTable({
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    capability: v.string(),
    constraintsJson: v.optional(v.string()),
    status: agentCapabilityGrantStatusValidator,
    grantedBy: v.optional(v.id("users")),
    deniedBy: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "status"])
    .index("by_agent_capability", ["agentId", "capability"]),

  agent_replay_records: defineTable({
    agentId: v.id("agents"),
    replayIdHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_replay_hash", ["replayIdHash"])
    .index("by_expiry", ["expiresAt"]),

  agent_host_replay_records: defineTable({
    hostId: v.id("agent_hosts"),
    replayIdHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_replay_hash", ["replayIdHash"])
    .index("by_expiry", ["expiresAt"]),

  agent_device_authorizations: defineTable({
    organizationId: v.id("organizations"),
    hostId: v.id("agent_hosts"),
    agentId: v.id("agents"),
    status: agentDeviceAuthorizationStatusValidator,
    userCodeHash: v.string(),
    deviceCodeHash: v.string(),
    pollCount: v.number(),
    pollIntervalSeconds: v.number(),
    nextPollAt: v.number(),
    expiresAt: v.number(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    deniedBy: v.optional(v.id("users")),
    deniedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_code_hash", ["userCodeHash"])
    .index("by_device_code_hash", ["deviceCodeHash"])
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "status"])
    .index("by_expiry", ["expiresAt"]),

  agent_device_authorization_attempts: defineTable({
    operatorUserId: v.id("users"),
    attempts: v.number(),
    windowStartedAt: v.number(),
    blockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_operator", ["operatorUserId"]),

  agent_auth_audit_events: defineTable({
    organizationId: v.id("organizations"),
    hostId: v.optional(v.id("agent_hosts")),
    agentId: v.optional(v.id("agents")),
    actorType: agentAuthAuditActorTypeValidator,
    actorUserId: v.optional(v.id("users")),
    eventType: v.string(),
    reasonCode: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization_created_at", ["organizationId", "createdAt"])
    .index("by_agent_created_at", ["agentId", "createdAt"])
    .index("by_host_created_at", ["hostId", "createdAt"]),

  auth_md_registrations: defineTable({
    resource: v.string(),
    loginHintHash: v.string(),
    scopes: v.array(v.string()),
    status: authMdRegistrationStatusValidator,
    claimTokenHash: v.string(),
    claimViewTokenHash: v.string(),
    userCodeHash: v.string(),
    pollCount: v.number(),
    pollIntervalSeconds: v.number(),
    nextPollAt: v.number(),
    failedCodeAttempts: v.number(),
    expiresAt: v.number(),
    userCodeExpiresAt: v.number(),
    claimedByUserId: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
    claimedAt: v.optional(v.number()),
    assertionIssuedAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_claim_token_hash", ["claimTokenHash"])
    .index("by_claim_view_token_hash", ["claimViewTokenHash"])
    .index("by_user_status", ["claimedByUserId", "status"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_expiry", ["expiresAt"]),

  auth_md_assertions: defineTable({
    registrationId: v.id("auth_md_registrations"),
    resource: v.string(),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    scopes: v.array(v.string()),
    status: authMdAssertionStatusValidator,
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_registration_status", ["registrationId", "status"])
    .index("by_expiry", ["expiresAt"]),

  auth_md_credentials: defineTable({
    registrationId: v.id("auth_md_registrations"),
    assertionId: v.id("auth_md_assertions"),
    resource: v.string(),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    scopes: v.array(v.string()),
    status: authMdCredentialStatusValidator,
    expiresAt: v.number(),
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_registration_status", ["registrationId", "status"])
    .index("by_user_organization", ["userId", "organizationId"])
    .index("by_expiry", ["expiresAt"]),

  auth_md_audit_events: defineTable({
    registrationId: v.id("auth_md_registrations"),
    assertionId: v.optional(v.id("auth_md_assertions")),
    credentialId: v.optional(v.id("auth_md_credentials")),
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    actorType: authMdAuditActorTypeValidator,
    actorUserId: v.optional(v.id("users")),
    eventType: v.string(),
    reasonCode: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_registration_created_at", ["registrationId", "createdAt"])
    .index("by_organization_created_at", ["organizationId", "createdAt"]),

  api_keys: defineTable({
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    /**
     * Leading plaintext of the issued key (e.g. "vb_test_a829"). Mirrors better-auth's
     * `start`: enough for a dashboard to identify a key without ever storing the secret.
     */
    keyStart: v.optional(v.string()),
    environment: v.optional(apiKeyEnvironmentValidator),
    ownerType: v.optional(apiKeyOwnerTypeValidator),
    ownerId: v.optional(v.string()),
    ownerServicePrincipalId: v.optional(v.id("service_principals")),
    fixedOrganizationId: v.optional(v.id("organizations")),
    permissions: v.optional(v.array(v.string())),
    requestId: v.optional(v.string()),
    requestIdExpiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
    allowedIpRanges: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
    status: apiKeyStatusValidator,
    lastUsedAt: v.optional(v.number()),
    lastUsedIp: v.optional(v.string()),
    // Fixed-window rate limiting, per key. Modelled on better-auth's api-key plugin.
    rateLimitEnabled: v.optional(v.boolean()),
    rateLimitTimeWindowMs: v.optional(v.number()),
    rateLimitMax: v.optional(v.number()),
    requestCount: v.optional(v.number()),
    windowStartedAt: v.optional(v.number()),
    lastRequestAt: v.optional(v.number()),
    // Quota, independent of the rate limit: a total budget that refills on an interval.
    remaining: v.optional(v.number()),
    refillAmount: v.optional(v.number()),
    refillIntervalMs: v.optional(v.number()),
    lastRefillAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_key_prefix", ["keyPrefix"])
    .index("by_organization_environment", ["organizationId", "environment"])
    .index("by_owner_service", ["ownerServicePrincipalId"])
    .index("by_owner_service_status", ["ownerServicePrincipalId", "status"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_organization_and_request_id", ["organizationId", "requestId"]),

  auth_audit_events: defineTable({
    actorUserId: v.optional(v.id("users")),
    actorType: authAuditActorTypeValidator,
    eventType: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_event_type", ["eventType"])
    .index("by_created_at", ["createdAt"]),

  webhook_endpoints: defineTable({
    organizationId: v.optional(v.id("organizations")),
    url: v.string(),
    description: v.optional(v.string()),
    eventTypes: v.array(v.string()),
    secret: v.string(),
    status: webhookEndpointStatusValidator,
    createdBy: v.optional(v.id("users")),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_org_status", ["organizationId", "status"]),

  webhook_deliveries: defineTable({
    endpointId: v.id("webhook_endpoints"),
    eventId: v.string(),
    eventType: v.string(),
    payloadJson: v.string(),
    status: webhookDeliveryStatusValidator,
    attemptCount: v.number(),
    nextAttemptAt: v.optional(v.number()),
    responseStatus: v.optional(v.number()),
    responseBody: v.optional(v.string()),
    failureKind: v.optional(webhookFailureKindValidator),
    deliveredAt: v.optional(v.number()),
    exhaustedAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_endpoint", ["endpointId"])
    .index("by_event", ["eventId"])
    .index("by_endpoint_status", ["endpointId", "status"])
    .index("by_next_attempt", ["nextAttemptAt"])
    .index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  mcp_oauth_authorization_codes: defineTable({
    code: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    betterAuthUserId: v.string(),
    organizationId: v.string(),
    scopes: v.array(v.string()),
    codeChallenge: v.string(),
    codeChallengeMethod: v.literal("S256"),
    state: v.optional(v.string()),
    audience: v.string(),
    resourceId: v.string(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  mcp_oauth_signing_keys: defineTable({
    keyId: v.string(),
    algorithm: v.literal("ES256"),
    publicJwkJson: v.string(),
    privateJwkJson: v.string(),
    status: v.union(v.literal("active"), v.literal("retired")),
    retiredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key_id", ["keyId"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updatedAt"])
    .index("by_status_updated_at", ["status", "updatedAt"])
    .index("by_status_retired_at", ["status", "retiredAt"]),

  mcp_oauth_clients: defineTable({
    clientId: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
    allowedScopes: v.array(v.string()),
    tokenEndpointAuthMethod: v.literal("none"),
    pkceRequired: v.boolean(),
    grantTypes: v.array(v.string()),
    responseTypes: v.array(v.string()),
    softwareId: v.optional(v.string()),
    softwareVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_client_id", ["clientId"]),

  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
    credentialHash: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_provider_issuer_subject", ["provider", "issuer", "subject"]),

  authSessions: defineTable({
    sessionId: v.string(),
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  authRefreshTokens: defineTable({
    tokenHash: v.string(),
    sessionId: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  mcp_oauth_refresh_tokens: defineTable({
    tokenHash: v.string(),
    tokenId: v.string(),
    familyId: v.string(),
    parentTokenId: v.optional(v.string()),
    clientId: v.string(),
    betterAuthUserId: v.string(),
    organizationId: v.string(),
    scopes: v.array(v.string()),
    audience: v.string(),
    resourceId: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    inactivityExpiresAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    replacedByTokenId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_family_id", ["familyId"]),

  mcp_oauth_revoked_families: defineTable({
    familyId: v.string(),
    revokedAt: v.number(),
    reason: v.union(v.literal("replay_detected"), v.literal("concurrent_conflict")),
  }).index("by_family_id", ["familyId"]),

  authVerificationCodes: defineTable({
    userId: v.id("users"),
    type: verificationCodeTypeValidator,
    tokenHash: v.string(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash", "type"])
    .index("by_user_type", ["userId", "type"]),

  authVerifiers: defineTable({
    verifierId: v.string(),
    type: v.string(),
    provider: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
    metadata: v.optional(v.string()),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_verifier_id", ["verifierId"])
    .index("by_expires_at", ["expiresAt"]),

  authRateLimits: defineTable({
    identifier: v.string(),
    windowStart: v.number(),
    count: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier_window", ["identifier", "windowStart"])
    .index("by_window", ["windowStart"]),

  authMagicLinkTokens: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    tokenHash: v.string(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_email", ["email"]),
});
