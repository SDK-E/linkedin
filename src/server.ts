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

const clientId = process.env.LINKEDIN_CLIENT_ID ?? "78jqrkg3nmf02l";
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3000/oauth/linkedin/callback";
const port = Number(process.env.PORT ?? 3000);

type OAuthState = { userKey: string; createdAt: number };
const sessionKey = (key: string) => `linkedin:session:${key}`;
const stateKey = (state: string) => `linkedin:oauth-state:${state}`;

function userKey(req: express.Request) {
  return String(req.header("x-sdk-user-id") ?? req.query.user ?? "default");
}

async function authUrl(key: string) {
  const state = crypto.randomBytes(24).toString("hex");
  await put(stateKey(state), { userKey: key, createdAt: Date.now() } satisfies OAuthState, 600);
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, scope: "openid profile email w_member_social" });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

app.get("/", (_req, res) => res.json({ name: "SDK LinkedIn", mcp: "/mcp", mode: "multi-user" }));
app.get("/oauth/linkedin/start", async (req, res) => res.redirect(await authUrl(userKey(req))));
app.get("/oauth/linkedin/callback", async (req, res) => {
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    const pending = await get<OAuthState>(stateKey(state));
    await remove(stateKey(state));
    if (!code || !pending || Date.now() - pending.createdAt > 10 * 60_000) return res.status(400).send("Invalid or expired OAuth callback");
    if (!clientSecret) return res.status(500).send("LINKEDIN_CLIENT_SECRET is not configured");

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    });
    if (!tokenResponse.ok) return res.status(502).send(await tokenResponse.text());
    const token = (await tokenResponse.json()) as { access_token: string; expires_in?: number };

    const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!userInfoResponse.ok) return res.status(502).send(await userInfoResponse.text());
    const user = (await userInfoResponse.json()) as { sub: string; name?: string };

    const session: LinkedInSession = {
      accessToken: token.access_token,
      personUrn: `urn:li:person:${user.sub}`,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
    };
    await put(sessionKey(pending.userKey), session, token.expires_in);
    res.send(`LinkedIn connected${user.name ? ` as ${user.name}` : ""}. You can close this tab.`);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "OAuth failed");
  }
});

app.post("/oauth/linkedin/disconnect", async (req, res) => {
  await remove(sessionKey(userKey(req)));
  res.status(204).end();
});

function createMcpServer(key: string) {
  const server = new McpServer({ name: "sdk-linkedin", version: "0.3.0" });

  server.registerTool("linkedin_auth_status", {
    title: "LinkedIn auth status",
    description: "Check whether this user's LinkedIn account is connected and return an authorization URL when needed.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => {
    const session = await get<LinkedInSession>(sessionKey(key));
    const authorizationUrl = session ? null : await authUrl(key);
    return { content: [{ type: "text", text: session ? "LinkedIn is connected." : `LinkedIn is not connected. Open: ${authorizationUrl}` }], structuredContent: { connected: Boolean(session), authorizationUrl } };
  });

  server.registerTool("linkedin_publish_post", {
    title: "Publish LinkedIn post",
    description: "Publish a text post to the connected user's LinkedIn profile.",
    inputSchema: { commentary: z.string().min(1).max(3000) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ commentary }) => {
    const session = await get<LinkedInSession>(sessionKey(key));
    if (!session) throw new Error(`LinkedIn is not connected. Open ${await authUrl(key)}`);
    const postId = await publishText(session, commentary);
    return { content: [{ type: "text", text: `Published LinkedIn post${postId ? `: ${postId}` : "."}` }], structuredContent: { postId } };
  });

  server.registerTool("linkedin_publish_image_post", {
    title: "Publish LinkedIn image post",
    description: "Publish a post with an image to the connected user's LinkedIn profile.",
    inputSchema: { commentary: z.string().min(1).max(3000), imageUrl: z.string().url(), altText: z.string().max(1000).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ commentary, imageUrl, altText }) => {
    const session = await get<LinkedInSession>(sessionKey(key));
    if (!session) throw new Error(`LinkedIn is not connected. Open ${await authUrl(key)}`);
    const postId = await publishImage(session, commentary, imageUrl, altText);
    return { content: [{ type: "text", text: `Published LinkedIn image post${postId ? `: ${postId}` : "."}` }], structuredContent: { postId } };
  });

  return server;
}

app.all("/mcp", async (req, res) => {
  const server = createMcpServer(userKey(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on("close", () => void transport.close());
});

if (!process.env.VERCEL) app.listen(port, () => console.log(`SDK LinkedIn MCP listening on :${port}`));

export default app;
