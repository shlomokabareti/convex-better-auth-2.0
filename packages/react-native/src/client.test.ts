import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ExpoBetterAuthClient } from "./client";
import {
  deriveExpoConvexSiteUrl,
  buildExpoTrustedOrigins,
  normalizeExpoTrustedOrigin,
  resolveExpoAuthConfig,
  resolveExpoAuthClientMode,
  resolveExpoScheme,
} from "./config";

type Assert<T extends true> = T;
type HasKey<Value, Key extends PropertyKey> = Key extends keyof Value
  ? true
  : false;
type TypeProofPlugin = {
  id: "convex-type-proof";
  getActions: () => {
    convexTypeProof: () => true;
  };
};
type NativeClientTypeProof = ExpoBetterAuthClient<"ios">;
type WebClientTypeProof = ExpoBetterAuthClient<"web">;
type CustomClientTypeProof = ExpoBetterAuthClient<
  "ios",
  readonly [TypeProofPlugin]
>;

type NativeClientHasDefaultActions = Assert<
  HasKey<NativeClientTypeProof, "signIn">
>;
type NativeClientHasExpoActions = Assert<
  HasKey<NativeClientTypeProof, "getCookie">
>;
type NativeClientHasConvexActions = Assert<
  HasKey<NativeClientTypeProof, "convex">
>;
type NativeClientHasTwoFactorActions = Assert<
  HasKey<NativeClientTypeProof, "twoFactor">
>;
type WebClientHasCrossDomainActions = Assert<
  HasKey<WebClientTypeProof, "getSessionData">
>;
type ClientPreservesCustomPluginActions = Assert<
  HasKey<CustomClientTypeProof, "convexTypeProof">
>;

export type ExpoBetterAuthClientTypeProof = [
  NativeClientHasDefaultActions,
  NativeClientHasExpoActions,
  NativeClientHasConvexActions,
  NativeClientHasTwoFactorActions,
  WebClientHasCrossDomainActions,
  ClientPreservesCustomPluginActions,
];

describe("convex expo auth client helpers", () => {
  it("selects the native Expo plugin path by default", () => {
    assert.deepEqual(resolveExpoAuthClientMode({ scheme: "plasma" }), {
      kind: "native",
      scheme: "plasma",
      storagePrefix: "plasma",
    });
  });

  it("selects cross-domain mode for Expo web", () => {
    assert.deepEqual(
      resolveExpoAuthClientMode({
        platformOS: "web",
        scheme: "plasma://",
        storagePrefix: "plasma-auth",
      }),
      {
        kind: "web",
        scheme: "plasma",
        storagePrefix: "plasma-auth",
      }
    );
  });

  it("normalizes trusted origins for Better Auth server config", () => {
    assert.equal(normalizeExpoTrustedOrigin("plasma://"), "plasma://");
    assert.deepEqual(
      buildExpoTrustedOrigins({
        includeExpoDevelopmentOrigins: true,
        scheme: "plasma",
        siteUrl: "https://plasma-dev.convex.convex.nyc",
      }),
      [
        "plasma://",
        "https://plasma-dev.convex.convex.nyc",
        "exp://",
        "exp://**",
        "exp://192.168.*.*:*/**",
      ]
    );
  });

  it("resolves app config from Expo env and scheme values", () => {
    assert.deepEqual(
      resolveExpoAuthConfig({
        convexUrl: "https://veil-dev.convex.convex.nyc",
        platformOS: "ios",
        scheme: ["veil", "veil-dev"],
      }),
      {
        convexSiteUrl: "https://veil-dev.convex.convex.nyc",
        convexUrl: "https://veil-dev.convex.convex.nyc",
        platformOS: "ios",
        scheme: "veil",
      }
    );
    assert.equal(
      deriveExpoConvexSiteUrl("https://veil-dev.convex.convex.nyc"),
      "https://veil-dev.convex.convex.nyc"
    );
    assert.equal(resolveExpoScheme("veil://"), "veil");
  });

  it("keeps Convex Cloud URL derivation for non-Convex consumers", () => {
    assert.equal(
      deriveExpoConvexSiteUrl("https://example.convex.cloud"),
      "https://example.convex.site"
    );
  });

  it("rejects missing and malformed schemes", () => {
    assert.throws(
      () => resolveExpoAuthClientMode({ scheme: "" }),
      /Expo auth scheme is required/
    );
    assert.throws(
      () => resolveExpoAuthClientMode({ scheme: "bad scheme" }),
      /Invalid Expo auth scheme/
    );
  });
});
