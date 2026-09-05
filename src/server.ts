import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { publishImage, publishText, type LinkedInSession } from "./linkedin.js";
import { get, put, remove } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

const clientId = process.env.LINKEDIN_CLIENT_ID ?? "78jqrkg3nmf02l";
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3000/oauth/linkedin/callback";
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? new URL(redirectUri).origin;
const port = Number(process.env.PORT ?? 3000);

const MCP_SCOPES = ["linkedin", "offline_access"];

type DirectOAuthState = { kind: "direct"; userKey: string; createdAt: number };
type McpOAuthState = {
  kind: "mcp";
  clientId: string;
  redirectUri: string;
  downstreamState?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope: string;
  createdAt: number;
};
type OAuthState = DirectOAuthState | McpOAuthState;

type OAuthClient = {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  createdAt: number;
};

type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  userKey: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope: string;
  createdAt: number;
};

type AccessGrant = { userKey: string; clientId: string; scope: string; createdAt: number };
type RefreshGrant = { userKey: string; clientId: string; scope: string; createdAt: number };

const sessionKey = (key: string) => `linkedin:session:${key}`;
const stateKey = (state: string) => `linkedin:oauth-state:${state}`;
const oauthClientKey = (id: string) => `mcp:oauth-client:${id}`;
const authCodeKey = (code: string) => `mcp:auth-code:${code}`;
const accessTokenKey = (token: string) => `mcp:access-token:${token}`;
const refreshTokenKey = (token: string) => `mcp:refresh-token:${token}`;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(value: string) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function linkedInAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email w_member_social",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

async function directAuthUrl(userKey: string) {
  const state = randomToken(24);
  await put(stateKey(state), { kind: "direct", userKey, createdAt: Date.now() } satisfies DirectOAuthState, 600);
  return linkedInAuthorizationUrl(state);
}

function oauthError(res: express.Response, status: number, error: string, description?: string) {
  return res.status(status).json({ error, ...(description ? { error_description: description } : {}) });
}

async function bearerGrant(req: express.Request) {
  const authorization = req.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return get<AccessGrant>(accessTokenKey(match[1]));
}

app.get("/", (_req, res) => res.json({ name: "SDK LinkedIn", mcp: "/mcp", mode: "oauth-multi-user" }));

const protectedResourceMetadata = (_req: express.Request, res: express.Response) =>
  res.json({
    resource: `${publicBaseUrl}/mcp`,
    authorization_servers: [publicBaseUrl],
    scopes_supported: MCP_SCOPES,
    bearer_methods_supported: ["header"],
  });
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);

app.get("/.well-known/oauth-authorization-server", (_req, res) =>
  res.json({
    issuer: publicBaseUrl,
    authorization_endpoint: `${publicBaseUrl}/oauth/authorize`,
    token_endpoint: `${publicBaseUrl}/oauth/token`,
    registration_endpoint: `${publicBaseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: MCP_SCOPES,
  }),
);

app.post("/oauth/register", async (req, res) => {
  const redirectUris: string[] = Array.isArray(req.body?.redirect_uris)
    ? req.body.redirect_uris.filter((value: unknown): value is string => typeof value === "string")
    : [];
  if (!redirectUris.length || redirectUris.some((uri: string) => !/^https:\/\//i.test(uri))) {
    return oauthError(res, 400, "invalid_redirect_uri", "At least one HTTPS redirect_uri is required.");
  }

  const id = randomToken(24);
  const record: OAuthClient = {
    clientId: id,
    redirectUris,
    clientName: typeof req.body?.client_name === "string" ? req.body.client_name : undefined,
    createdAt: Date.now(),
  };
  await put(oauthClientKey(id), record);

  return res.status(201).json({
    client_id: id,
    client_id_issued_at: Math.floor(record.createdAt / 1000),
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    client_name: record.clientName,
  });
});

app.get("/oauth/authorize", async (req, res) => {
  const responseType = String(req.query.response_type ?? "");
  const requestedClientId = String(req.query.client_id ?? "");
  const requestedRedirectUri = String(req.query.redirect_uri ?? "");
  const downstreamState = typeof req.query.state === "string" ? req.query.state : undefined;
  const codeChallenge = typeof req.query.code_challenge === "string" ? req.query.code_challenge : undefined;
  const codeChallengeMethod = typeof req.query.code_challenge_method === "string" ? req.query.code_challenge_method : undefined;
  const scope = typeof req.query.scope === "string" ? req.query.scope : MCP_SCOPES.join(" ");

  if (responseType !== "code") return oauthError(res, 400, "unsupported_response_type");
  const oauthClient = await get<OAuthClient>(oauthClientKey(requestedClientId));
  if (!oauthClient || !oauthClient.redirectUris.includes(requestedRedirectUri)) {
    return oauthError(res, 400, "invalid_request", "Unknown client_id or redirect_uri.");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return oauthError(res, 400, "invalid_request", "PKCE with S256 is required.");
  }

  const state = randomToken(24);
  await put(
    stateKey(state),
    {
      kind: "mcp",
      clientId: requestedClientId,
      redirectUri: requestedRedirectUri,
      downstreamState,
      codeChallenge,
      codeChallengeMethod,
      scope,
      createdAt: Date.now(),
    } satisfies McpOAuthState,
    600,
  );
  return res.redirect(linkedInAuthorizationUrl(state));
});

app.post("/oauth/token", async (req, res) => {
  const grantType = String(req.body?.grant_type ?? "");

  if (grantType === "authorization_code") {
    const code = String(req.body?.code ?? "");
    const requestedClientId = String(req.body?.client_id ?? "");
    const requestedRedirectUri = String(req.body?.redirect_uri ?? "");
    const codeVerifier = String(req.body?.code_verifier ?? "");
    const grant = await get<AuthorizationCode>(authCodeKey(code));
    if (!grant) return oauthError(res, 400, "invalid_grant");

    await remove(authCodeKey(code));
    if (grant.clientId !== requestedClientId || grant.redirectUri !== requestedRedirectUri) {
      return oauthError(res, 400, "invalid_grant");
    }
    if (!grant.codeChallenge || sha256Base64Url(codeVerifier) !== grant.codeChallenge) {
      return oauthError(res, 400, "invalid_grant", "PKCE verification failed.");
    }

    const accessToken = randomToken(32);
    const refreshToken = randomToken(40);
    await put(accessTokenKey(accessToken), { userKey: grant.userKey, clientId: grant.clientId, scope: grant.scope, createdAt: Date.now() } satisfies AccessGrant, 3600);
    await put(refreshTokenKey(refreshToken), { userKey: grant.userKey, clientId: grant.clientId, scope: grant.scope, createdAt: Date.now() } satisfies RefreshGrant, 60 * 60 * 24 * 90);
    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: grant.scope,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(req.body?.refresh_token ?? "");
    const requestedClientId = String(req.body?.client_id ?? "");
    const grant = await get<RefreshGrant>(refreshTokenKey(refreshToken));
    if (!grant || grant.clientId !== requestedClientId) return oauthError(res, 400, "invalid_grant");

    const accessToken = randomToken(32);
    await put(accessTokenKey(accessToken), { userKey: grant.userKey, clientId: grant.clientId, scope: grant.scope, createdAt: Date.now() } satisfies AccessGrant, 3600);
    return res.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: grant.scope });
  }

  return oauthError(res, 400, "unsupported_grant_type");
});

app.get("/oauth/linkedin/start", async (req, res) => {
  const userKey = typeof req.query.user === "string" ? req.query.user : "manual";
  return res.redirect(await directAuthUrl(userKey));
});

app.get("/oauth/linkedin/callback", async (req, res) => {
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    const pending = await get<OAuthState>(stateKey(state));
    await remove(stateKey(state));
    if (!code || !pending || Date.now() - pending.createdAt > 10 * 60_000) {
      return res.status(400).send("Invalid or expired OAuth callback");
    }
    if (!clientSecret) return res.status(500).send("LINKEDIN_CLIENT_SECRET is not configured");

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenResponse.ok) return res.status(502).send(await tokenResponse.text());
    const token = (await tokenResponse.json()) as { access_token: string; expires_in?: number };

    const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userInfoResponse.ok) return res.status(502).send(await userInfoResponse.text());
    const user = (await userInfoResponse.json()) as { sub: string; name?: string };
    const userKey = `linkedin:${user.sub}`;

    const session: LinkedInSession = {
      accessToken: token.access_token,
      personUrn: `urn:li:person:${user.sub}`,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
    };
    await put(sessionKey(userKey), session, token.expires_in);

    if (pending.kind === "mcp") {
      const authCode = randomToken(32);
      await put(
        authCodeKey(authCode),
        {
          clientId: pending.clientId,
          redirectUri: pending.redirectUri,
          userKey,
          codeChallenge: pending.codeChallenge,
          codeChallengeMethod: pending.codeChallengeMethod,
          scope: pending.scope,
          createdAt: Date.now(),
        } satisfies AuthorizationCode,
        300,
      );
      const callback = new URL(pending.redirectUri);
      callback.searchParams.set("code", authCode);
      if (pending.downstreamState) callback.searchParams.set("state", pending.downstreamState);
      callback.searchParams.set("iss", publicBaseUrl);
      return res.redirect(callback.toString());
    }

    await put(sessionKey(pending.userKey), session, token.expires_in);
    return res.send(`LinkedIn connected${user.name ? ` as ${user.name}` : ""}. You can close this tab.`);
  } catch (error) {
    return res.status(500).send(error instanceof Error ? error.message : "OAuth failed");
  }
});

function createMcpServer(userKey: string) {
  const server = new McpServer({ name: "sdk-linkedin", version: "0.4.0" });

  server.registerTool(
    "linkedin_auth_status",
    {
      title: "LinkedIn auth status",
      description: "Check whether the authenticated user's LinkedIn connection is available.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const session = await get<LinkedInSession>(sessionKey(userKey));
      return {
        content: [{ type: "text", text: session ? "LinkedIn is connected." : "LinkedIn connection is unavailable or expired." }],
        structuredContent: { connected: Boolean(session) },
      };
    },
  );

  server.registerTool(
    "linkedin_publish_post",
    {
      title: "Publish LinkedIn post",
      description: "Publish a text post to the authenticated user's LinkedIn profile.",
      inputSchema: { commentary: z.string().min(1).max(3000) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ commentary }) => {
      const session = await get<LinkedInSession>(sessionKey(userKey));
      if (!session) throw new Error("LinkedIn connection is unavailable or expired. Reconnect the app.");
      const postId = await publishText(session, commentary);
      return {
        content: [{ type: "text", text: `Published LinkedIn post${postId ? `: ${postId}` : "."}` }],
        structuredContent: { postId },
      };
    },
  );

  server.registerTool(
    "linkedin_publish_image_post",
    {
      title: "Publish LinkedIn image post",
      description: "Publish a post with an image to the authenticated user's LinkedIn profile.",
      inputSchema: {
        commentary: z.string().min(1).max(3000),
        imageUrl: z.string().url(),
        altText: z.string().max(1000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ commentary, imageUrl, altText }) => {
      const session = await get<LinkedInSession>(sessionKey(userKey));
      if (!session) throw new Error("LinkedIn connection is unavailable or expired. Reconnect the app.");
      const postId = await publishImage(session, commentary, imageUrl, altText);
      return {
        content: [{ type: "text", text: `Published LinkedIn image post${postId ? `: ${postId}` : "."}` }],
        structuredContent: { postId },
      };
    },
  );

  return server;
}

app.all("/mcp", async (req, res) => {
  const grant = await bearerGrant(req);
  if (!grant) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${publicBaseUrl}/.well-known/oauth-protected-resource/mcp"`,
    );
    return res.status(401).json({ error: "unauthorized" });
  }

  const server = createMcpServer(grant.userKey);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on("close", () => void transport.close());
});

if (!process.env.VERCEL) app.listen(port, () => console.log(`SDK LinkedIn MCP listening on :${port}`));

export default app;
