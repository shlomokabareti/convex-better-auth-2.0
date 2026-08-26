/// <reference types="vite/client" />

import type { GenericSchema, SchemaDefinition } from "convex/server";

import schema from "./dist/component/schema.js";

type ConvexTestModules = Record<string, () => Promise<unknown>>;
type ComponentSchema = SchemaDefinition<GenericSchema, boolean>;

const modules: ConvexTestModules = import.meta.glob("./dist/component/**/*.js");

for (const path of Object.keys(modules)) {
  if (
    path.endsWith(".test.js") ||
    path.endsWith("/convex.config.js") ||
    path.endsWith("/schema.js")
  ) {
    delete modules[path];
  }
}

export function register(
  test: {
    registerComponent: (name: string, schema: ComponentSchema, modules: ConvexTestModules) => void;
  },
  name = "convexAuth",
) {
  test.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
export { modules, schema };
