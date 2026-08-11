# How seoblog works

Technical companion to the README. The README says what it does; this explains
how, and where the bodies are buried.

## Architecture: no agent runtime, no MCP server

This plugin is a port of an Apify actor that ran the Claude Agent SDK against an
MCP server exposing CMS/image tools. In plugin form all of that disappears:

- **Claude Code is the agent.** The actor's 320-line system prompt became four
  skills; the input schema became the `/seoblog:setup` interview; the
  agent-loop, billing and IPC code have no equivalent because the session you
  are already in is the loop.
- **No MCP server.** MCP earns its keep for cross-turn state (demoday's live
  browser) — every seoblog operation is a one-shot HTTP or generation call, so
  they are plain CLI scripts invoked with Bash. Research uses Claude Code's
  native WebSearch/WebFetch.
- **Scripts speak JSON.** stdout = exactly one JSON line, stderr = human
  progress. That's what makes them composable from a skill.

```
commands/  write | setup | publish | status      thin entrypoints
skills/    seo-blog (orchestrator, autonomous)   what Claude reads
           seo-research | seo-writing | blog-publish
scripts/   doctor.mjs    preflight, free connectivity check
           gen-image.mjs fal.ai image gen (+OG crop)
           cms.mjs       list/create/update/get/upload-image, 3 adapters
scripts/lib/ env, config, fal, models, args, log
```

## Autonomous by design

The write flow asks the user nothing — runs are often scheduled unattended
(cron/Overboard), so a question means a failed run. The old interactive gates
became self-enforced invariants:

1. **Outline** — Claude self-checks topic dedup, title, and H2/H3 plan against
   the config, then proceeds.
2. **Image spend** — count comes from the articleLength table; price from
   `scripts/lib/models.mjs` (the one authoritative price registry). The cost is
   logged in the run report, not asked about.
3. **Draft-always** — every run ends as a draft; `cms.mjs create` hardcodes
   `status: "draft"` regardless of input. Publishing is exclusively the
   separate PATCH flip via `/seoblog:publish` (or a prompt that explicitly
   says to publish).

## The Articles API contract

The generic remote-posting API (implemented by plugmyplugin.com; also served by
the Cue Up WordPress plugin — `cmsType: wordpress` is a pure alias):

```
GET    {baseUrl}/api/articles?limit=&offset=      list; X-API-Key ⇒ drafts too
POST   {baseUrl}/api/articles                     {title, body, excerpt, author,
                                                   status, tags, metaDescription,
                                                   slug?} → {id, slug}
GET    {baseUrl}/api/articles/:id                 full article
PATCH  {baseUrl}/api/articles/:id                 partial update / status flip
DELETE {baseUrl}/api/articles/:id
POST   {baseUrl}/api/articles/:id/upload-image?purpose=hero|inline|og&alt_text=…
       multipart field "image" → {imageUrl}
```

`purpose=og` is this plugin's extension for social-card images. The CLI always
sends an `Origin: <baseUrl>` header on multipart POSTs — server-to-server
clients send none by default and some frameworks (Astro's CSRF checkOrigin)
reject originless multipart.

**Shopify** is a native adapter instead: Admin REST 2024-01 for articles
(hero = featured image via base64 attachment; metaDescription = the
`global.description_tag` metafield) and GraphQL staged uploads for inline
images. OG images degrade to a Files upload — Shopify themes own og:image.

## Adapter matrix

| | articles-api | wordpress | shopify |
|---|---|---|---|
| wire | /api/articles | same (Cue Up WP plugin) | Admin API 2024-01 |
| auth | X-API-Key | X-API-Key | X-Shopify-Access-Token |
| draft/publish | status field | status field | published boolean |
| og image | purpose=og | purpose=og | Files upload (theme owns og:image) |
| get by id | ✓ | ✓ | ✗ (use list) |

## Where keys live

Resolution order, first hit wins (see `scripts/lib/env.mjs` for the full why —
short version: the plugin's install dir is version-pinned and wiped on update,
so a `.env` there is a trap):

| Source | Survives plugin update? |
|---|---|
| environment / `~/.claude/settings.json` "env" | ✓ |
| macOS Keychain, service `seoblog` (`FAL_API_KEY`, `site:<id>`) | ✓ recommended |
| `~/.config/seoblog/config.json` | ✓ (plaintext — dev convenience) |
| `.env` in a repo checkout | ✗ dev only |

Per-site keys can also come from env as `SEOBLOG_SITE_<ID>_API_KEY`. Nothing in
the plugin ever *writes* a secret — setup prints `security add-generic-password`
commands for the user's own terminal, so keys never enter the session
transcript.

## Config and state

`~/.config/seoblog/config.json` — sites (baseUrl, cmsType, author, niche, tone,
directions, articleLength, product, shopifyBlogId) + defaultSite. Non-secret,
written by setup.

`~/.config/seoblog/state/<siteId>.json` — articleHistory + keywordQueue +
lastRunAt. This replaces the actor's Apify KV store: dedup across runs, and the
queue is what a bare `/seoblog:write` drains. Claude edits these files directly;
there is no IPC.

Both live under `~/.config` precisely because the plugin cache directory does
not survive updates.

## Developing from a clone

```
git clone …seoblog-claude-plugin && cd plugins/seoblog && npm install
cp .env.example .env   # dev keys
node scripts/doctor.mjs
/plugin marketplace add /path/to/checkout   # repo root, then /plugin install seoblog
```

`doctor.mjs` doubles as the selftest: every check is free, including the live
connectivity probe (a 1-article GET that proves the key).
