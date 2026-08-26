export type AuthPreflightSeverity = "error" | "warning" | "info";

export type AuthPreflightCheck = {
  name: string;
  severity: AuthPreflightSeverity;
  ok: boolean;
  message: string;
};

export type AuthPreflightResult = {
  ok: boolean;
  checks: AuthPreflightCheck[];
};

export type AuthPreflightAppServerProbe = {
  baseUrl: string | null | undefined;
  expectedValues?: string[];
  probePaths?: string[];
  timeoutMs?: number;
};

export type AuthPreflightOptions = {
  betterAuthUrl?: string | null;
  backendSetup?: AuthPreflightBackendSetup;
  convexUrl?: string | null;
  expectedPackageVersion?: string | null;
  actualPackageVersion?: string | null;
  fetchImpl?: typeof fetch;
  appServer?: AuthPreflightAppServerProbe;
  extraChecks?: readonly AuthPreflightCheck[];
};

export type AuthPreflightBackendSetup = {
  files?: readonly AuthPreflightRequiredFile[];
  envGroups?: readonly AuthPreflightRequiredEnvGroup[];
};

export type AuthPreflightRequiredFile = {
  name: string;
  path: string;
  content: string | null | undefined;
  requiredSnippets?: readonly string[];
};

export type AuthPreflightRequiredEnvGroup = {
  name: string;
  envNames: readonly string[];
  values: Record<string, string | undefined>;
  severity?: AuthPreflightSeverity;
};

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_APP_PROBE_PATHS = ["/"];

export async function runAuthPreflight(
  options: AuthPreflightOptions
): Promise<AuthPreflightResult> {
  const checks: AuthPreflightCheck[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const betterAuthUrl = normalizeUrl(options.betterAuthUrl);
  const convexUrl = normalizeUrl(options.convexUrl);

  checks.push(requiredUrlCheck("VITE_BETTER_AUTH_URL", betterAuthUrl));
  checks.push(requiredUrlCheck("VITE_CONVEX_URL", convexUrl));

  if (betterAuthUrl !== null) {
    checks.push(await checkAuthSessionEndpoint(fetchImpl, betterAuthUrl));
    checks.push(await checkTokenEndpoint(fetchImpl, betterAuthUrl));
    checks.push(await checkJwksEndpoint(fetchImpl, betterAuthUrl));
  }

  if (convexUrl !== null) {
    checks.push(await checkConvexDeployment(fetchImpl, convexUrl));
  }

  if (options.expectedPackageVersion || options.actualPackageVersion) {
    checks.push(
      checkPackageVersion(
        options.expectedPackageVersion ?? null,
        options.actualPackageVersion ?? null
      )
    );
  }

  if (options.appServer !== undefined) {
    checks.push(...(await checkAppServer(fetchImpl, options.appServer)));
  }

  if (options.backendSetup !== undefined) {
    checks.push(...checkBackendSetup(options.backendSetup));
  }

  checks.push(...(options.extraChecks ?? []));

  return {
    checks,
    ok: checks.every((check) => check.ok || check.severity !== "error"),
  };
}

export function formatAuthPreflightResult(result: AuthPreflightResult): string {
  const lines = result.checks.map((check) => {
    const prefix = check.ok ? "PASS" : check.severity.toUpperCase();
    return `[${prefix}] ${check.name}: ${check.message}`;
  });

  lines.push(result.ok ? "Auth preflight passed." : "Auth preflight failed.");
  return lines.join("\n");
}

function checkBackendSetup(
  setup: AuthPreflightBackendSetup
): AuthPreflightCheck[] {
  return [
    ...(setup.files ?? []).map(checkRequiredFile),
    ...(setup.envGroups ?? []).map(checkRequiredEnvGroup),
  ];
}

function checkRequiredFile(
  file: AuthPreflightRequiredFile
): AuthPreflightCheck {
  if (file.content === null || file.content === undefined) {
    return errorCheck(file.name, `${file.path} is missing.`);
  }

  const missingSnippets = (file.requiredSnippets ?? []).filter(
    (snippet) => !file.content?.includes(snippet)
  );

  if (missingSnippets.length > 0) {
    return errorCheck(
      file.name,
      `${file.path} is missing required setup: ${missingSnippets.join(", ")}.`
    );
  }

  return passCheck(file.name, file.path);
}

function checkRequiredEnvGroup(
  group: AuthPreflightRequiredEnvGroup
): AuthPreflightCheck {
  const configuredName = group.envNames.find((name) =>
    Boolean(group.values[name]?.trim())
  );

  if (configuredName !== undefined) {
    return passCheck(group.name, `configured via ${configuredName}.`);
  }

  return {
    name: group.name,
    severity: group.severity ?? "error",
    ok: false,
    message: `Set one of: ${group.envNames.join(", ")}.`,
  };
}

function requiredUrlCheck(
  name: string,
  value: string | null
): AuthPreflightCheck {
  if (value === null) {
    return {
      name,
      severity: "error",
      ok: false,
      message: `${name} is missing or is not a valid URL.`,
    };
  }

  return {
    name,
    severity: "error",
    ok: true,
    message: value,
  };
}

async function checkAuthSessionEndpoint(
  fetchImpl: typeof fetch,
  betterAuthUrl: string
) {
  const url = new URL(
    "./get-session",
    ensureTrailingSlash(betterAuthUrl)
  ).toString();
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    { credentials: "include" },
    DEFAULT_TIMEOUT_MS
  );

  if (response.kind === "network-error") {
    return errorCheck(
      "Better Auth /get-session",
      `unreachable: ${response.message}`
    );
  }

  if (response.status === 404) {
    return errorCheck(
      "Better Auth /get-session",
      "endpoint returned 404; Better Auth routes are missing."
    );
  }

  if (response.status >= 500) {
    return errorCheck(
      "Better Auth /get-session",
      `endpoint returned ${response.status}.`
    );
  }

  return passCheck(
    "Better Auth /get-session",
    `reachable with status ${response.status}.`
  );
}

async function checkTokenEndpoint(
  fetchImpl: typeof fetch,
  betterAuthUrl: string
) {
  const url = new URL(
    "./convex/token",
    ensureTrailingSlash(betterAuthUrl)
  ).toString();
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    { credentials: "include" },
    DEFAULT_TIMEOUT_MS
  );

  if (response.kind === "network-error") {
    return errorCheck(
      "Better Auth /convex/token",
      `unreachable: ${response.message}`
    );
  }

  if (response.status === 404) {
    return errorCheck(
      "Better Auth /convex/token",
      "endpoint returned 404; Convex plugin is missing."
    );
  }

  if (response.status >= 500) {
    return errorCheck(
      "Better Auth /convex/token",
      `endpoint returned ${response.status}.`
    );
  }

  return passCheck(
    "Better Auth /convex/token",
    `reachable with status ${response.status}.`
  );
}

async function checkJwksEndpoint(
  fetchImpl: typeof fetch,
  betterAuthUrl: string
) {
  const url = new URL(
    "./convex/jwks",
    ensureTrailingSlash(betterAuthUrl)
  ).toString();
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    {},
    DEFAULT_TIMEOUT_MS
  );

  if (response.kind === "network-error") {
    return errorCheck(
      "Better Auth /convex/jwks",
      `unreachable: ${response.message}`
    );
  }

  if (response.status === 404) {
    return errorCheck(
      "Better Auth /convex/jwks",
      "endpoint returned 404; Convex plugin JWKS is missing."
    );
  }

  if (response.status >= 500) {
    return errorCheck(
      "Better Auth /convex/jwks",
      `endpoint returned ${response.status}.`
    );
  }

  return passCheck(
    "Better Auth /convex/jwks",
    `reachable with status ${response.status}.`
  );
}

async function checkConvexDeployment(
  fetchImpl: typeof fetch,
  convexUrl: string
) {
  const response = await fetchWithTimeout(
    fetchImpl,
    convexUrl,
    {},
    DEFAULT_TIMEOUT_MS
  );

  if (response.kind === "network-error") {
    return errorCheck("Convex deployment", `unreachable: ${response.message}`);
  }

  if (response.status >= 500) {
    return errorCheck("Convex deployment", `returned ${response.status}.`);
  }

  return passCheck(
    "Convex deployment",
    `reachable with status ${response.status}.`
  );
}

function checkPackageVersion(
  expectedPackageVersion: string | null,
  actualPackageVersion: string | null
): AuthPreflightCheck {
  if (!expectedPackageVersion || !actualPackageVersion) {
    return warningCheck(
      "Package version",
      `expected=${expectedPackageVersion ?? "<missing>"} actual=${actualPackageVersion ?? "<missing>"}`
    );
  }

  if (expectedPackageVersion === actualPackageVersion) {
    return passCheck("Package version", actualPackageVersion);
  }

  if (
    expectedPackageVersion.startsWith("link:") ||
    expectedPackageVersion.startsWith("file:")
  ) {
    return passCheck(
      "Package version",
      `local dependency ${expectedPackageVersion} resolved to package version ${actualPackageVersion}.`
    );
  }

  return errorCheck(
    "Package version",
    `expected @vortexnyc/auth ${expectedPackageVersion}, found ${actualPackageVersion}.`
  );
}

async function checkAppServer(
  fetchImpl: typeof fetch,
  probe: AuthPreflightAppServerProbe
) {
  const baseUrl = normalizeUrl(probe.baseUrl);
  if (baseUrl === null) {
    return [
      warningCheck(
        "App server",
        "PLAYWRIGHT_TEST_BASE_URL is missing or invalid."
      ),
    ];
  }

  const timeoutMs = probe.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const health = await fetchWithTimeout(fetchImpl, baseUrl, {}, timeoutMs);
  if (health.kind === "network-error") {
    return [
      warningCheck(
        "App server",
        `not running at ${baseUrl}; Playwright may start it.`
      ),
    ];
  }

  const checks = [
    passCheck("App server", `reachable with status ${health.status}.`),
  ];
  const expectedValues = probe.expectedValues ?? [];
  if (expectedValues.length === 0) {
    return checks;
  }

  const paths = probe.probePaths?.length
    ? probe.probePaths
    : DEFAULT_APP_PROBE_PATHS;
  const servedText = (
    await fetchAppServerProbeBodies(fetchImpl, baseUrl, paths, timeoutMs)
  ).join("\n");
  checks.push(...checkServedExpectedValues(servedText, expectedValues));

  return checks;
}

async function fetchAppServerProbeBodies(
  fetchImpl: typeof fetch,
  baseUrl: string,
  paths: readonly string[],
  timeoutMs: number
): Promise<string[]> {
  const probes = await Promise.all(
    paths.map(async (path) => {
      const url = new URL(path, ensureTrailingSlash(baseUrl)).toString();
      const response = await fetchWithTimeout(fetchImpl, url, {}, timeoutMs);
      const body =
        response.kind === "response" && response.status < 500
          ? await response.text()
          : null;
      return { body, url };
    })
  );
  const bodies: string[] = [];
  const scriptUrls = new Set<string>();
  for (const { body, url } of probes) {
    if (body !== null) {
      bodies.push(body);
      for (const scriptUrl of extractSameOriginScriptUrls(body, url))
        scriptUrls.add(scriptUrl);
    }
  }
  bodies.push(...(await fetchScriptBodies(fetchImpl, scriptUrls, timeoutMs)));
  return bodies;
}

async function fetchScriptBodies(
  fetchImpl: typeof fetch,
  scriptUrls: ReadonlySet<string>,
  timeoutMs: number
): Promise<string[]> {
  return Promise.all(
    [...scriptUrls].map(async (scriptUrl) => {
      const response = await fetchWithTimeout(
        fetchImpl,
        scriptUrl,
        {},
        timeoutMs
      );
      return response.kind === "response" && response.status < 500
        ? response.text()
        : "";
    })
  ).then((bodies) => bodies.filter((body) => body.length > 0));
}

function checkServedExpectedValues(
  servedText: string,
  expectedValues: readonly string[]
): AuthPreflightCheck[] {
  return expectedValues.map((expectedValue) =>
    servedText.includes(expectedValue)
      ? passCheck("App served env", `found ${expectedValue}.`)
      : errorCheck(
          "App served env",
          `running app server is not serving ${expectedValue}.`
        )
  );
}

function extractSameOriginScriptUrls(html: string, pageUrl: string): string[] {
  const page = new URL(pageUrl);
  const urls: string[] = [];
  const scriptTagPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagPattern.exec(html)) !== null) {
    const src = match[1];
    if (!src) continue;
    const scriptUrl = new URL(src, page);
    if (scriptUrl.origin !== page.origin) continue;
    urls.push(scriptUrl.toString());
  }
  return urls;
}

type FetchWithTimeoutResult =
  | {
      kind: "response";
      status: number;
      text: () => Promise<string>;
    }
  | {
      kind: "network-error";
      message: string;
    };

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<FetchWithTimeoutResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    return {
      kind: "response",
      status: response.status,
      text: async () => await response.text(),
    };
  } catch (error) {
    return {
      kind: "network-error",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function passCheck(name: string, message: string): AuthPreflightCheck {
  return { name, severity: "info", ok: true, message };
}

function warningCheck(name: string, message: string): AuthPreflightCheck {
  return { name, severity: "warning", ok: false, message };
}

function errorCheck(name: string, message: string): AuthPreflightCheck {
  return { name, severity: "error", ok: false, message };
}
