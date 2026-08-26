/**
 * Unit coverage for org security policy decisions (VOR-183).
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  evaluateOrganizationSecurityAccess,
  evaluateOrgMfaRequirement,
  evaluateOrgSessionTimeout,
  parseOrganizationSecurityPolicy,
} from "./organizationSecurityPolicy";

describe("organizationSecurityPolicy (VOR-183)", () => {
  it("defaults requireMfa to false", () => {
    assert.deepEqual(parseOrganizationSecurityPolicy(undefined), {
      requireMfa: false,
    });
    assert.deepEqual(
      parseOrganizationSecurityPolicy(JSON.stringify({ security: {} })),
      { requireMfa: false }
    );
  });

  it("parses requireMfa + sessionTimeoutMinutes", () => {
    assert.deepEqual(
      parseOrganizationSecurityPolicy(
        JSON.stringify({
          security: { requireMfa: true, sessionTimeoutMinutes: 90 },
        })
      ),
      { requireMfa: true, sessionTimeoutMinutes: 90 }
    );
  });

  it("blocks when MFA required and TOTP off", () => {
    const denial = evaluateOrgMfaRequirement({
      requireMfa: true,
      twoFactorEnabled: false,
    });
    assert.equal(denial?.code, "ORG_MFA_REQUIRED");
  });

  it("allows when MFA required and TOTP on", () => {
    assert.equal(
      evaluateOrgMfaRequirement({
        requireMfa: true,
        twoFactorEnabled: true,
      }),
      null
    );
  });

  it("blocks sessions past org timeout", () => {
    const now = 1_000_000;
    const denial = evaluateOrgSessionTimeout({
      sessionTimeoutMinutes: 60,
      sessionCreatedAt: now - 61 * 60_000,
      now,
    });
    assert.equal(denial?.code, "ORG_SESSION_TIMEOUT");
  });

  it("combined access evaluator runs MFA before timeout", () => {
    const denial = evaluateOrganizationSecurityAccess({
      policy: { requireMfa: true, sessionTimeoutMinutes: 60 },
      twoFactorEnabled: false,
      sessionCreatedAt: Date.now(),
    });
    assert.equal(denial?.code, "ORG_MFA_REQUIRED");
  });
});
