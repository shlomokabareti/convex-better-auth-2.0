import { httpActionGeneric, type HttpRouter } from "convex/server";
import { getJwks } from "./jwt.js";

export function addNativeAuthHttpRoutes(http: HttpRouter): void {
  http.route({
    path: "/.well-known/jwks.json",
    method: "GET",
    handler: httpActionGeneric(async () => {
      return new Response(JSON.stringify(getJwks()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}
