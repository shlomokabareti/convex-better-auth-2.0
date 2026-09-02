import { describe, it } from "vitest";
import type { ComponentApi as FullComponentApi } from "../../component/_generated/component";
import type { ComponentApi as CoreComponentApi } from "../../component/core/_generated/component";
import { convexAuth } from "./convexAuth";
import type { NativeEmailAndPasswordComponentHandle } from "./types";

// Compile-time checks that the full and core components can be passed to
// convexAuth() as components.core.
type _AssertFullSatisfiesNativeHandle =
  FullComponentApi<"convexAuth"> extends NativeEmailAndPasswordComponentHandle
    ? true
    : false;
type _AssertCoreSatisfiesNativeHandle =
  CoreComponentApi<"convexAuthCore"> extends NativeEmailAndPasswordComponentHandle
    ? true
    : false;

describe("convexAuth component handle types", () => {
  it("accepts convexAuth and convexAuthCore as component/components.core", () => {
    const fullComponent = {} as unknown as FullComponentApi<"convexAuth">;
    const coreComponent = {} as unknown as CoreComponentApi<"convexAuthCore">;

    // If these compile, the config accepts both generated component handles.
    convexAuth({ component: fullComponent });
    convexAuth({ component: coreComponent });
    convexAuth({ components: { core: fullComponent } });
    convexAuth({ components: { core: coreComponent } });

    // Runtime assertion placeholder.
    const _yes = true;
    void _yes;
  });
});
