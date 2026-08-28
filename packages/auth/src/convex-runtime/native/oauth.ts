import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

export type OAuthUserInfo = {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  emailVerified: boolean;
};

export type OAuthToken = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scopes?: string[];
};

export type OAuthProviderOptions = {
  /** Disable all sign ups for this provider, even with `requestSignUp`. */
  disableSignUp?: boolean;
  /** Disable sign up unless the client explicitly passes `requestSignUp`. */
  disableImplicitSignUp?: boolean;
  /** Require the provider to report the email as verified before issuing a session. */
  requireEmailVerification?: boolean;
  /** Extra query parameters to append to the authorization URL. */
  additionalParams?: Record<string, string>;
};

export type NativeOAuthProvider = {
  id: string;
  name: string;
  issuer: string;
  options: OAuthProviderOptions;
  createAuthorizationURL(args: {
    state: string;
    codeChallenge: string;
    redirectURI: string;
    scopes?: string[];
  }): URL;
  exchangeAuthorizationCode(args: {
    code: string;
    codeVerifier: string;
    redirectURI: string;
  }): Promise<OAuthToken>;
  getUserInfo(args: {
    accessToken: string;
    idToken?: string;
  }): Promise<{ user: OAuthUserInfo; data: unknown }>;
};

export type GitHubProfile = {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
};

export type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
};

export type GitHubProviderConfig = OAuthProviderOptions & {
  clientId: string;
  clientSecret: string;
  /** @default "https://github.com" */
  enterpriseBaseUrl?: string;
  /** @default ["read:user", "user:email"] */
  scopes?: string[];
  /** Override fetch for testing. */
  fetchImpl?: typeof fetch;
};

function getGitHubUrls(config: GitHubProviderConfig): {
  authorize: string;
  token: string;
  apiBase: string;
  issuer: string;
} {
  if (config.enterpriseBaseUrl) {
    const base = new URL(config.enterpriseBaseUrl);
    return {
      authorize: `${base.origin}/login/oauth/authorize`,
      token: `${base.origin}/login/oauth/access_token`,
      apiBase: `${base.origin}/api/v3`,
      issuer: `${base.origin}/login/oauth`,
    };
  }
  return {
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    apiBase: "https://api.github.com",
    issuer: "https://github.com/login/oauth",
  };
}

export type GoogleProfile = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
};

export type GoogleProviderConfig = OAuthProviderOptions & {
  clientId: string;
  clientSecret: string;
  /** @default ["openid", "email", "profile"] */
  scopes?: string[];
  /** Override fetch for testing. */
  fetchImpl?: typeof fetch;
  /** Request a refresh token by setting `access_type=offline`. */
  accessType?: "online" | "offline";
  /** @default "consent" when `accessType` is "offline" */
  prompt?: "none" | "select_account" | "consent" | "login";
  /** Pre-fill the login hint. */
  loginHint?: string;
  /** Restrict to a Google Workspace hosted domain. */
  hd?: string;
  /** Forward granted scopes from previous authorizations. */
  includeGrantedScopes?: boolean;
  /** Maximum age in seconds for a Google ID token. */
  maxTokenAge?: number;
};

export function createGoogleProvider(config: GoogleProviderConfig): NativeOAuthProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const defaultScopes = ["openid", "email", "profile"];

  const providerOptions: OAuthProviderOptions = {
    disableSignUp: config.disableSignUp,
    disableImplicitSignUp: config.disableImplicitSignUp,
    requireEmailVerification: config.requireEmailVerification,
    additionalParams: config.additionalParams,
  };

  return {
    id: "google",
    name: "Google",
    issuer: "https://accounts.google.com",
    options: providerOptions,

    createAuthorizationURL({ state, codeChallenge, redirectURI, scopes }) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectURI);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");

      const requestedScopes = [...defaultScopes];
      if (scopes?.length) {
        for (const scope of scopes) {
          if (!requestedScopes.includes(scope)) {
            requestedScopes.push(scope);
          }
        }
      }
      url.searchParams.set("scope", requestedScopes.join(" "));

      if (config.accessType) url.searchParams.set("access_type", config.accessType);
      if (config.prompt) url.searchParams.set("prompt", config.prompt);
      if (config.loginHint) url.searchParams.set("login_hint", config.loginHint);
      if (config.hd) url.searchParams.set("hd", config.hd);
      if (config.includeGrantedScopes !== false) {
        url.searchParams.set("include_granted_scopes", "true");
      }
      if (config.additionalParams) {
        for (const [key, value] of Object.entries(config.additionalParams)) {
          if (!url.searchParams.has(key)) {
            url.searchParams.set(key, value);
          }
        }
      }

      return url;
    },

    async exchangeAuthorizationCode({ code, codeVerifier, redirectURI }) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURI,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });

      const response = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = (await response.json()) as
        | {
            access_token: string;
            token_type?: string;
            scope?: string;
            refresh_token?: string;
            id_token?: string;
            expires_in?: number;
          }
        | { error: string; error_description?: string; error_uri?: string };

      if ("error" in data) {
        throw new Error(
          `Google token exchange failed: ${data.error} ${data.error_description ?? ""}`.trim(),
        );
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data.scope ? data.scope.split(" ") : undefined,
      };
    },

    async getUserInfo({ accessToken, idToken }) {
      if (idToken) {
        const jwksResponse = await fetchImpl("https://www.googleapis.com/oauth2/v3/certs");
        if (!jwksResponse.ok) {
          throw new Error(`Google JWKS request failed: ${jwksResponse.status}`);
        }
        const jwks = (await jwksResponse.json()) as JSONWebKeySet;
        const jwksSet = createLocalJWKSet(jwks);
        const { payload } = await jwtVerify(idToken, jwksSet, {
          algorithms: ["RS256"],
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: config.clientId,
          maxTokenAge: config.maxTokenAge,
        });

        const hd = config.hd;
        if (hd && payload.hd !== hd) {
          throw new Error(`Google id_token hosted domain mismatch: expected ${hd}`);
        }

        return {
          user: {
            id: String(payload.sub),
            name: payload.name as string | undefined,
            email: payload.email as string | undefined,
            image: payload.picture as string | undefined,
            emailVerified: payload.email_verified === true,
          },
          data: payload,
        };
      }

      const response = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Google userinfo request failed: ${response.status}`);
      }
      const profile = (await response.json()) as GoogleProfile;

      return {
        user: {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ?? false,
        },
        data: profile,
      };
    },
  };
}

export function createGitHubProvider(config: GitHubProviderConfig): NativeOAuthProvider {
  const urls = getGitHubUrls(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const defaultScopes = ["read:user", "user:email"];

  const providerOptions: OAuthProviderOptions = {
    disableSignUp: config.disableSignUp,
    disableImplicitSignUp: config.disableImplicitSignUp,
    requireEmailVerification: config.requireEmailVerification,
    additionalParams: config.additionalParams,
  };

  return {
    id: "github",
    name: "GitHub",
    issuer: urls.issuer,
    options: providerOptions,

    createAuthorizationURL({ state, codeChallenge, redirectURI, scopes }) {
      const url = new URL(urls.authorize);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectURI);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");

      const requestedScopes = [...defaultScopes];
      if (scopes?.length) {
        for (const scope of scopes) {
          if (!requestedScopes.includes(scope)) {
            requestedScopes.push(scope);
          }
        }
      }
      url.searchParams.set("scope", requestedScopes.join(" "));

      if (config.additionalParams) {
        for (const [key, value] of Object.entries(config.additionalParams)) {
          if (!url.searchParams.has(key)) {
            url.searchParams.set(key, value);
          }
        }
      }

      return url;
    },

    async exchangeAuthorizationCode({ code, codeVerifier, redirectURI }) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURI,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });

      const response = await fetchImpl(urls.token, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = (await response.json()) as
        | {
            access_token: string;
            token_type?: string;
            scope?: string;
            refresh_token?: string;
            id_token?: string;
            expires_in?: number;
          }
        | { error: string; error_description?: string; error_uri?: string };

      if ("error" in data) {
        throw new Error(
          `GitHub token exchange failed: ${data.error} ${data.error_description ?? ""}`.trim(),
        );
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data.scope ? data.scope.split(",") : undefined,
      };
    },

    async getUserInfo({ accessToken }) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "convex-auth",
        Accept: "application/vnd.github+json",
      };

      const profileResponse = await fetchImpl(`${urls.apiBase}/user`, { headers });
      if (!profileResponse.ok) {
        throw new Error(`GitHub userinfo request failed: ${profileResponse.status}`);
      }
      const profile = (await profileResponse.json()) as GitHubProfile;

      let email = profile.email ?? undefined;
      let emailVerified = false;

      const emailsResponse = await fetchImpl(`${urls.apiBase}/user/emails`, { headers });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as GitHubEmail[];
        if (!email) {
          const primary = emails.find((e) => e.primary) ?? emails[0];
          if (primary) {
            email = primary.email;
            emailVerified = primary.verified;
          }
        } else {
          const matched = emails.find((e) => e.email === email);
          emailVerified = matched?.verified ?? false;
        }
      }

      return {
        user: {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email,
          image: profile.avatar_url,
          emailVerified,
        },
        data: profile,
      };
    },
  };
}

export type DiscordProfile = {
  id: string;
  username: string;
  email?: string;
  verified?: boolean;
  avatar?: string | null;
};

export type DiscordProviderConfig = OAuthProviderOptions & {
  clientId: string;
  clientSecret: string;
  /** @default ["identify", "email"] */
  scopes?: string[];
  /** Override fetch for testing. */
  fetchImpl?: typeof fetch;
};

export function createDiscordProvider(config: DiscordProviderConfig): NativeOAuthProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const defaultScopes = ["identify", "email"];

  const providerOptions: OAuthProviderOptions = {
    disableSignUp: config.disableSignUp,
    disableImplicitSignUp: config.disableImplicitSignUp,
    requireEmailVerification: config.requireEmailVerification,
    additionalParams: config.additionalParams,
  };

  return {
    id: "discord",
    name: "Discord",
    issuer: "https://discord.com",
    options: providerOptions,

    createAuthorizationURL({ state, codeChallenge, redirectURI, scopes }) {
      const url = new URL("https://discord.com/oauth2/authorize");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectURI);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");

      const requestedScopes = [...defaultScopes];
      if (scopes?.length) {
        for (const scope of scopes) {
          if (!requestedScopes.includes(scope)) {
            requestedScopes.push(scope);
          }
        }
      }
      url.searchParams.set("scope", requestedScopes.join(" "));

      if (config.additionalParams) {
        for (const [key, value] of Object.entries(config.additionalParams)) {
          if (!url.searchParams.has(key)) {
            url.searchParams.set(key, value);
          }
        }
      }

      return url;
    },

    async exchangeAuthorizationCode({ code, codeVerifier, redirectURI }) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURI,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });

      const response = await fetchImpl("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = (await response.json()) as
        | {
            access_token: string;
            token_type?: string;
            scope?: string;
            refresh_token?: string;
            expires_in?: number;
          }
        | { error: string; error_description?: string };

      if ("error" in data) {
        throw new Error(
          `Discord token exchange failed: ${data.error} ${data.error_description ?? ""}`.trim(),
        );
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data.scope ? data.scope.split(" ") : undefined,
      };
    },

    async getUserInfo({ accessToken }) {
      const response = await fetchImpl("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Discord userinfo request failed: ${response.status}`);
      }
      const profile = (await response.json()) as DiscordProfile;

      const image = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : undefined;

      return {
        user: {
          id: profile.id,
          name: profile.username,
          email: profile.email,
          image,
          emailVerified: profile.verified ?? false,
        },
        data: profile,
      };
    },
  };
}
