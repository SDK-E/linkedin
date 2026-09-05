# AGENTS.md

Goal: maintain a small, production-grade ChatGPT App/MCP integration that can publish to Hicham SADDEK's personal LinkedIn account.

Rules:
- Prefer current official OpenAI Apps SDK/MCP and LinkedIn API documentation over model memory.
- Use existing maintained packages before custom implementations.
- Keep modules small and readable; avoid generated abstractions and unnecessary layers.
- Never commit credentials, access tokens, refresh tokens, or LinkedIn client secrets.
- Treat all publish tools as write actions and make their intent explicit.
- Keep LinkedIn API versioning centralized.
- Preserve support for text and image posts; add document/multi-image support without breaking existing tools.
- Store both generated draft and final published copy once history storage is introduced so the content engine can learn Hicham's edits.
- Validate with typecheck and tests before merging.
- Keep documentation synchronized with tool names and OAuth scopes.
