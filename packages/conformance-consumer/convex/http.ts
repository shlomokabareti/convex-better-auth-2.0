import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { components } from "./_generated/api";
import { addNativeAuthHttpRoutes } from "convex-auth/convex/http";

const http = httpRouter();
addNativeAuthHttpRoutes(http, components.convexAuth, api.auth);

export default http;
