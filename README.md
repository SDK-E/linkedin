# LinkedIn Pilot

ChatGPT App / MCP server by SDK Enterprises for publishing to personal LinkedIn accounts.

## MCP tools

- `linkedin_auth_status`
- `linkedin_publish_post`
- `linkedin_publish_image_post`
- `linkedin_schedule_post`
- `linkedin_schedule_image_post`
- `linkedin_list_scheduled_posts`
- `linkedin_cancel_scheduled_post`

Publish tools return the LinkedIn post ID and a usable post URL.

## LinkedIn access

The app uses LinkedIn OAuth with `openid`, `profile`, `email`, and `w_member_social`. Never commit the LinkedIn client secret or user tokens.

## Scheduling

Scheduled posts are stored in the encrypted service store and dispatched through QStash at the requested time. Required production variables:

- `PUBLIC_BASE_URL=https://linkedin.sdk.enterprises`
- `QSTASH_TOKEN`
- `SCHEDULER_DISPATCH_SECRET`

The QStash free tier supports delays up to 7 days; longer delays require a paid QStash plan.

## Public routes

- `/` — product landing page
- `/privacy` — privacy page
- `/terms` — terms page
- `/health` — health check
- `/mcp` — authenticated MCP endpoint

## Local run

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Architecture

ChatGPT authenticates to this MCP server through OAuth 2.1 + PKCE. The server delegates account authorization to LinkedIn and isolates sessions by the authenticated LinkedIn member. Scheduled delivery uses a private authenticated callback and idempotent schedule records.
