import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createBetterAuthConvexClient } from "./createBetterAuthClient";

describe("createBetterAuthConvexClient", () => {
  it("installs cross-domain and Convex client helpers", () => {
    const client: unknown = createBetterAuthConvexClient({
      baseURL: "https://auth.example.test/api/auth",
    });

    assert.ok((typeof client === "object" || typeof client === "function") && client !== null);
    assert.equal(typeof Reflect.get(client, "getCookie"), "function");
    const convex = Reflect.get(client, "convex");
    assert.ok((typeof convex === "object" || typeof convex === "function") && convex !== null);
    assert.equal(typeof Reflect.get(convex, "token"), "function");
  });
});
