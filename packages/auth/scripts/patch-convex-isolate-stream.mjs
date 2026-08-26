// Post-build patch: neutralize the node:stream leak in the Convex-isolate entries.
//
// @react-email/render (used to render Convex Auth's verification/reset emails) bundles an
// isomorphic readStream helper with a static `import { Writable } from "stream"`. esbuild
// force-externalizes node builtins under platform:node (bypassing both `alias` and
// onResolve plugins — both were tried and fail), so the import survives into the bundled
// isolate entries (convex, index, better-auth-server) and breaks `convex codegen` for every
// fresh Convex Auth consumer ("Could not resolve 'stream'").
//
// The Node-Writable branch is dead code in Node 18+ AND the Convex isolate (both use
// WebStreams with pipeTo), so we replace the unresolvable external import with a local
// never-instantiated stub. STRICTLY fail-closed: every isolate entry must exist, contain the
// import, and be patched, and a final scan must prove NONE retains a stream import — so a
// partial/changed build can never silently ship the leak.
import { readFile, writeFile } from "node:fs/promises";

const FILES = ["dist/convex.js", "dist/index.js", "dist/better-auth-server.js"];
// Quote- AND whitespace-agnostic (\s matches newlines): esbuild emits a single-line
// double-quoted import today, but a format change (single quotes, multiline braces) must not
// slip past the patch.
const IMPORT_RE =
  /import\s*\{\s*Writable\s*\}\s*from\s*['"\x60](?:node:)?stream['"\x60];/g;
// The final fail-closed scan is FORM-INDEPENDENT: it matches the exact stream module
// specifier ("stream" / "node:stream", single or double quote, exact close-quote so
// "stream/web" never matches) preceded by ANY import mechanism — `from`, static/dynamic
// `import`, `require`, or esbuild's `__require` — with any whitespace/paren between. This
// covers named, default, namespace, re-export, side-effect, dynamic, and require forms, so
// the script can never report success while a stream import in any shape survives.
const ANY_STREAM_IMPORT =
  /(?:\bfrom\s*|(?:\bimport\b|require)\s*\(?\s*)['"\x60](?:node:)?stream['"\x60]/;
const STUB =
  'class Writable { constructor() { throw new Error("convex-auth: node:stream Writable is stubbed and unavailable in this runtime — the isomorphic stream reader Node fallback is expected to be unreachable (WebStreams are used instead)."); } }';

const fail = (message) => {
  console.error(`patch-convex-isolate-stream: ${message}`);
  process.exit(1);
};

let totalPatched = 0;
for (const file of FILES) {
  // No try/catch: a missing isolate entry means the build shape changed — fail closed.
  let src;
  try {
    src = await readFile(file, "utf8");
  } catch {
    fail(
      `expected isolate entry ${file} was not produced by the build — cannot verify the node:stream fix.`
    );
  }
  const count = (src.match(IMPORT_RE) ?? []).length;
  if (count === 0) {
    continue;
  }
  await writeFile(file, src.replace(IMPORT_RE, STUB));
  totalPatched += count;
  console.log(`  patched ${file} (${count} import${count === 1 ? "" : "s"})`);
}

if (totalPatched === 0) {
  fail(
    'found no `import { Writable } from "stream"` in any isolate entry. Either the leak is ' +
      "gone (remove this patch) or a dependency changed its shape (investigate). Failing closed."
  );
}

// Final proof: no isolate entry may retain ANY node:stream import.
const stillLeaking = [];
for (const file of FILES) {
  const out = await readFile(file, "utf8");
  if (ANY_STREAM_IMPORT.test(out)) {
    stillLeaking.push(file);
  }
}
if (stillLeaking.length > 0) {
  fail(
    `node:stream still imported after patching: ${stillLeaking.join(", ")}. Failing closed.`
  );
}

console.log(
  `patch-convex-isolate-stream: stubbed node:stream in ${totalPatched} import(s) across the isolate entries; verified none remain.`
);
