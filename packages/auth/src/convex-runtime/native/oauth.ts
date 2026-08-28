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
  tokenType?: string;
  expiresAt?: number;
};

export type NativeOAuthProvider = {
  id: string;
  name: string;
  issuer: string;
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
  getUserInfo(args: { accessToken: string }): Promise<{ user: OAuthUserInfo; data: unknown }>;
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

export type GitHubProviderConfig = {
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

export type GoogleProviderConfig = {
  clientId: string;
  clientSecret: string;
  /** @default ["openid", "email", "profile"] */
  scopes?: string[];
  /** Override fetch for testing. */
  fetchImpl?: typeof fetch;
};

export function createGoogleProvider(config: GoogleProviderConfig): NativeOAuthProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const defaultScopes = ["openid", "email", "profile"];

  return {
    id: "google",
    name: "Google",
    issuer: "https://accounts.google.com",

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
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      };
    },

    async getUserInfo({ accessToken }) {
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

  return {
    id: "github",
    name: "GitHub",
    issuer: urls.issuer,

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
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
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
