# SDK-E LinkedIn ChatGPT App

ChatGPT App / MCP server for Hicham SADDEK's personal LinkedIn account.

## Tools

- `linkedin_auth_status`
- `linkedin_publish_post`
- `linkedin_publish_image_post`

## LinkedIn access

The app uses LinkedIn OAuth with:

- `openid`
- `profile`
- `email`
- `w_member_social`

Client ID is already configured in `.env.example`. Never commit the client secret.

## Local run

```bash
pnpm install
cp .env.example .env
pnpm dev
```

MCP endpoint: `http://localhost:3000/mcp`
LinkedIn connect: `http://localhost:3000/oauth/linkedin/start`

## Goal

Allow ChatGPT to publish the final version of a post directly to Hicham's LinkedIn profile, including image/meme posts, while keeping the publishing API separate from the content-generation workflow.

Next stages: durable OAuth/session handling, document/multi-image posts, post-history/edit-learning storage, scheduling integration, and production deployment.
