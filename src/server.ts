import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { publishImage, publishText, type LinkedInSession } from "./linkedin.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const clientId = process.env.LINKEDIN_CLIENT_ID ?? "78jqrkg3nmf02l";
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3000/oauth/linkedin/callback";
const port = Number(process.env.PORT ?? 3000);

let session: LinkedInSession | null = null;
const oauthStates = new Set<string>();

function authUrl() {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.add(state);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email w_member_social",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

app.get("/", (_req, res) => res.json({ name: "SDK LinkedIn", mcp: "/mcp", authenticated: Boolean(session) }));
app.get("/oauth/linkedin/start", (_req, res) => res.redirect(authUrl()));
app.get("/oauth/linkedin/callback", async (req, res) => {
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !state || !oauthStates.delete(state)) return res.status(400).send("Invalid OAuth callback");
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

    session = {
      accessToken: token.access_token,
      personUrn: `urn:li:person:${user.sub}`,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
    };
    res.send(`LinkedIn connected${user.name ? ` as ${user.name}` : ""}. You can close this tab.`);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "OAuth failed");
  }
});

function createMcpServer() {
  const server = new McpServer({ name: "sdk-linkedin", version: "0.1.0" });

  server.registerTool(
    "linkedin_auth_status",
    {
      title: "LinkedIn auth status",
      description: "Check whether the LinkedIn account is connected. If not, return the authorization URL.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => ({
      content: [{ type: "text", text: session ? "LinkedIn is connected." : `LinkedIn is not connected. Open: ${authUrl()}` }],
      structuredContent: { connected: Boolean(session), authorizationUrl: session ? null : authUrl() },
    }),
  );

  server.registerTool(
    "linkedin_publish_post",
    {
      title: "Publish LinkedIn post",
      description: "Publish a text post to the authenticated member's LinkedIn profile.",
      inputSchema: { commentary: z.string().min(1).max(3000) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ commentary }) => {
      if (!session) throw new Error(`LinkedIn is not connected. Open ${authUrl()}`);
      const postId = await publishText(session, commentary);
      return { content: [{ type: "text", text: `Published LinkedIn post${postId ? `: ${postId}` : "."}` }], structuredContent: { postId } };
    },
  );

  server.registerTool(
    "linkedin_publish_image_post",
    {
      title: "Publish LinkedIn image post",
      description: "Publish a LinkedIn post with an image fetched from a public URL.",
      inputSchema: {
        commentary: z.string().min(1).max(3000),
        imageUrl: z.string().url(),
        altText: z.string().max(1000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ commentary, imageUrl, altText }) => {
      if (!session) throw new Error(`LinkedIn is not connected. Open ${authUrl()}`);
      const postId = await publishImage(session, commentary, imageUrl, altText);
      return { content: [{ type: "text", text: `Published LinkedIn image post${postId ? `: ${postId}` : "."}` }], structuredContent: { postId } };
    },
  );

  return server;
}

app.all("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on("close", () => void transport.close());
});

app.listen(port, () => console.log(`SDK LinkedIn MCP listening on :${port}`));
