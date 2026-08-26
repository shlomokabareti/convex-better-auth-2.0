import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  getRequestIpFromHeaders,
  isIpAllowed,
  resolveApiKeyIpAllowlist,
} from "./apiKeyIpAllowlist";

describe("isIpAllowed", () => {
  it("allows every IPv4 address when allowlist is empty", () => {
    assert.equal(isIpAllowed("1.2.3.4", []), true);
    assert.equal(isIpAllowed("255.255.255.255", []), true);
    assert.equal(isIpAllowed("0.0.0.0", []), true);
  });

  it("matches exact IPv4 entries", () => {
    assert.equal(isIpAllowed("10.0.0.1", ["10.0.0.1"]), true);
    assert.equal(isIpAllowed("10.0.0.2", ["10.0.0.1"]), false);
  });

  it("matches CIDR ranges", () => {
    assert.equal(isIpAllowed("192.168.1.254", ["192.168.1.0/24"]), true);
    assert.equal(isIpAllowed("192.168.2.1", ["192.168.1.0/24"]), false);
    assert.equal(isIpAllowed("10.20.255.255", ["10.20.0.0/16"]), true);
    assert.equal(isIpAllowed("11.0.0.1", ["10.0.0.0/8"]), false);
  });

  it("supports /0 and unsigned 32-bit edge cases", () => {
    assert.equal(isIpAllowed("255.255.255.255", ["0.0.0.0/0"]), true);
    assert.equal(isIpAllowed("255.255.255.255", ["255.255.255.255"]), true);
    assert.equal(isIpAllowed("255.255.255.254", ["255.255.255.255"]), false);
    assert.equal(isIpAllowed("128.0.0.0", ["128.0.0.0/1"]), true);
    assert.equal(isIpAllowed("127.255.255.255", ["128.0.0.0/1"]), false);
  });

  it("rejects invalid IPs and CIDRs", () => {
    assert.equal(isIpAllowed("not-an-ip", ["10.0.0.0/8"]), false);
    assert.equal(isIpAllowed("256.0.0.1", ["10.0.0.0/8"]), false);
    assert.equal(isIpAllowed("10.0.0.1", ["invalid-cidr"]), false);
    assert.equal(isIpAllowed("10.0.0.1", ["10.0.0.0/33"]), false);
    assert.equal(isIpAllowed("::1", ["::1"]), false);
  });

  it("trims CIDR entries", () => {
    assert.equal(isIpAllowed("10.0.0.1", ["  10.0.0.0/8  "]), true);
  });
});

describe("getRequestIpFromHeaders", () => {
  it("prefers the first x-forwarded-for value", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.10",
    });

    assert.equal(getRequestIpFromHeaders(headers), "203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    assert.equal(
      getRequestIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.10" })),
      "198.51.100.10"
    );
  });
});

describe("resolveApiKeyIpAllowlist", () => {
  it("allows missing request IP when no allowlist is configured", () => {
    assert.deepEqual(
      resolveApiKeyIpAllowlist({ requestIp: null, allowedIpRanges: [] }),
      {
        ok: true,
        requestIp: null,
      }
    );
  });

  it("requires request IP when allowlist is configured", () => {
    assert.deepEqual(
      resolveApiKeyIpAllowlist({
        requestIp: null,
        allowedIpRanges: ["203.0.113.0/24"],
      }),
      {
        ok: false,
        reason: "missing_ip",
        requestIp: null,
      }
    );
  });

  it("rejects disallowed request IP", () => {
    assert.deepEqual(
      resolveApiKeyIpAllowlist({
        requestIp: "198.51.100.10",
        allowedIpRanges: ["203.0.113.0/24"],
      }),
      {
        ok: false,
        reason: "ip_not_allowed",
        requestIp: "198.51.100.10",
      }
    );
  });
});
