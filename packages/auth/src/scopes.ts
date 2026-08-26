/**
 * Public re-export of the issuance scope boundary.
 *
 * The constant itself lives under `component/` because that is what the Convex
 * component bundles and where issuance enforces it; consumers import it from
 * here so a route can name the same set the component refuses.
 */
export { assertScopesAreIssuable, NEVER_ISSUABLE_SCOPES } from "./component/scopes.js";
