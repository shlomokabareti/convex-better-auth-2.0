import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createAuthorizationDeniedErrorData,
  createAuthorizationDeniedErrorDataFromContext,
  extractAuthorizationDeniedAuditPayload,
  toAuthorizationDeniedAuditPayload,
} from "./authorizationDeniedPayload";

describe("authorizationDeniedPayload", () => {
  it("builds denied error data and converts it to an audit payload", () => {
    const errorData = createAuthorizationDeniedErrorData({
      code: "FORBIDDEN",
      message: "Permission required: org:manage_roles",
      authzCode: "PERMISSION_REQUIRED",
      actorUserId: "user_123",
      principalKind: "user",
      principalId: "user_123",
      organizationId: "org_123",
      denialReason: "permission",
      resourceType: "convex.mutation",
      resourceId: "organizationRoles:createCustomRole",
      permission: "org:manage_roles",
    });

    assert.deepEqual(toAuthorizationDeniedAuditPayload(errorData), {
      actorUserId: "user_123",
      principalKind: "user",
      principalId: "user_123",
      organizationId: "org_123",
      denialReason: "permission",
      denialCode: "PERMISSION_REQUIRED",
      reasonDetail: "Permission required: org:manage_roles",
      resourceType: "convex.mutation",
      resourceId: "organizationRoles:createCustomRole",
      permission: "org:manage_roles",
    });
  });

  it("creates denied error data from resolved auth context", () => {
    const errorData = createAuthorizationDeniedErrorDataFromContext({
      context: {
        principal: {
          kind: "user",
          userId: "user_123",
          identityId: "identity_123",
          activeOrganizationId: "org_123",
          membershipIds: [],
          roleKeys: [],
          permissions: ["org:manage_roles"],
          sessionId: "session_123",
          isRestricted: false,
          restrictedReason: null,
        },
        execution: {
          organizationId: "org_123",
          resourceType: "convex.action",
          resourceId: "organizationRoles:createCustomRole",
          audience: null,
          scopes: [],
        },
      },
      code: "FORBIDDEN",
      message: "Permission required: org:manage_roles",
      authzCode: "PERMISSION_REQUIRED",
      denialReason: "permission",
      actorUserId: "user_123",
      permission: "org:manage_roles",
    });

    assert.deepEqual(errorData, {
      code: "FORBIDDEN",
      message: "Permission required: org:manage_roles",
      authzCode: "PERMISSION_REQUIRED",
      actorUserId: "user_123",
      principalKind: "user",
      principalId: "user_123",
      organizationId: "org_123",
      denialReason: "permission",
      resourceType: "convex.action",
      resourceId: "organizationRoles:createCustomRole",
      permission: "org:manage_roles",
    });
  });

  it("extracts denied audit payload from thrown error data shape", () => {
    const payload = extractAuthorizationDeniedAuditPayload({
      data: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        authzCode: "AUTHENTICATION_REQUIRED",
        principalKind: "anonymous",
        principalId: null,
        denialReason: "authentication",
        resourceType: "convex.action",
        resourceId: "organizations:setActiveOrganization",
      },
    });

    assert.deepEqual(payload, {
      actorUserId: undefined,
      principalKind: "anonymous",
      principalId: null,
      organizationId: undefined,
      denialReason: "authentication",
      denialCode: "AUTHENTICATION_REQUIRED",
      reasonDetail: "Authentication required",
      resourceType: "convex.action",
      resourceId: "organizations:setActiveOrganization",
      permission: undefined,
    });
  });

  it("returns null for non-authz errors or partial data", () => {
    assert.equal(extractAuthorizationDeniedAuditPayload(new Error("boom")), null);
    assert.equal(
      extractAuthorizationDeniedAuditPayload({
        data: { denialReason: "permission" },
      }),
      null,
    );
    assert.equal(
      extractAuthorizationDeniedAuditPayload({
        data: {
          message: "Authentication required",
          principalKind: "anonymous",
          denialReason: "not-real",
          resourceType: "convex.action",
          resourceId: "organizations:setActiveOrganization",
        },
      }),
      null,
    );
  });
});
