# ChatGPT Marketplace / Plugins Directory

SDK LinkedIn is intended for public distribution as a ChatGPT app/plugin. Each user connects their own LinkedIn account through OAuth.

## Required before submission

- Public HTTPS MCP endpoint.
- Per-user OAuth isolation.
- Durable encrypted storage for OAuth state and LinkedIn tokens.
- Privacy policy and terms URLs.
- Clear tool descriptions and write-action confirmations.
- No secrets committed to the repository.
- Production redirect URI registered in the LinkedIn Developer app.
- Test text and image publishing with a non-production LinkedIn test account where possible.
- Validate tool schemas through ChatGPT tool scanning.

## Public capabilities

- Connect a LinkedIn member account.
- Check connection status.
- Publish a text post.
- Publish an image post.

Future capabilities should be added only when the required LinkedIn permissions are available and approved.

## Important platform constraint

Publishing the app to the Plugins Directory does not guarantee every ChatGPT plan can invoke every write action. Availability can depend on plan, workspace policy, region, and OpenAI rollout status.
