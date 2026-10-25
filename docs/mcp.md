# MCP server — managing carnaby.sk from Claude

The api exposes a remote [MCP](https://modelcontextprotocol.io) server at
**`https://carnaby.sk/api/mcp`** (Streamable HTTP, stateless, JSON responses). It can do
everything the `/admin` UI can, so content can be written, edited and published from any
Claude client — web, desktop, mobile or Claude Code.

Code: `apps/api/src/mcp/` (`server.ts` = tools, `mcp-auth.ts` = auth, `mcp.controller.ts` = HTTP).

## Tools

| Tool | What it does |
|---|---|
| `site_overview` | Counts by status/category, published posts missing a translation, top 10 by views, recent drafts |
| `list_posts` | Admin list (any status) — filter by status/category/featured, text search, sort, paging |
| `get_post` | Full post by `id` or `slug`: both translations (complete markdown), media, categories, URLs |
| `create_post` | New post; draft by default; slug derived from the SK title when omitted |
| `update_post` | **Partial** update — only passed fields change; per-language merge; `null` removes a language / clears a field |
| `set_post_status` | `draft` / `published` / `archived` |
| `delete_post` | Permanent delete; requires `confirmSlug` |
| `list_categories` | devlog / dodo / carnaby |
| `upload_image` | Store an image from a URL or base64 (jpeg/png/gif/webp, ≤ 10 MB); returns filename + markdown snippet; can set it as a post thumbnail |
| `set_thumbnail_from_youtube` | Download the video still and use it as the thumbnail |
| `list_users` | Registered users and roles |

The server also sends instructions (content model, categories, markdown conventions) that
Claude reads on connect.

Changes are live on the next page view — public pages read the api uncached
(`apps/web/lib/trpc-server.ts`).

## Connecting

### Claude (web, desktop, mobile) — recommended

Settings → Connectors → **Add custom connector** → URL `https://carnaby.sk/api/mcp`, leave the
OAuth fields empty. Claude registers itself, opens carnaby.sk's `/login`, you sign in with
Google, and the connector is ready. One setup on claude.ai covers the mobile app too.

### Claude Code

```bash
claude mcp add --transport http carnaby https://carnaby.sk/api/mcp   # OAuth in the browser (/mcp to sign in)
# or, with MCP_API_TOKEN set on the server:
claude mcp add --transport http carnaby https://carnaby.sk/api/mcp --header "Authorization: Bearer <token>"
```

## Security model

- **OAuth 2.1** via better-auth's `mcp` plugin (dynamic client registration, PKCE, opaque
  tokens in `oauth_access_token`; access token 7 days, refresh token 90 days). Discovery
  documents are served by better-auth under `/api/auth/.well-known/*`; `apps/web/next.config.js`
  rewrites the root `/.well-known/*` paths to them.
- **Anyone with a Google account can complete the OAuth flow, but only role `admin` can use the
  tools** — every MCP request re-checks the token owner's role (`403` otherwise). Admin role comes
  from `ADMIN_EMAILS`, applied at every sign-in.
- **`MCP_API_TOKEN`** (optional, ≥ 32 chars) is a fixed bearer token acting as the
  `ADMIN_EMAILS` user. Leave it empty unless a client needs it; rotate by changing the env value.
- Revoking access: delete the rows for the client in `oauth_access_token` /
  `oauth_application` (or the user's tokens), and/or unset `MCP_API_TOKEN`.

## Verifying after a deploy

1. `curl -s https://carnaby.sk/.well-known/oauth-protected-resource` → JSON with
   `"resource": "https://carnaby.sk/api/mcp"`.
2. `curl -si -X POST https://carnaby.sk/api/mcp` → `401` with a `WWW-Authenticate` header.
3. Add the connector in Claude and ask it to run `site_overview`.

Prerequisite for step 3: the Google OAuth client must list
`https://carnaby.sk/api/auth/callback/google` as an authorized redirect URI (see
`docs/deploy/cutover-checklist.md`).
