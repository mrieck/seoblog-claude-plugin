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
commands/  write | setup | publish | humanize | status | socialcue   thin entrypoints
skills/    seo-blog (orchestrator, autonomous)   what Claude reads
           seo-research | seo-writing | humanize | blog-images | blog-publish
           social-article (orchestrator for /seoblog:socialcue, two questions max)
           seoblog-humanize (rewrite an existing draft; Codex entry point)
scripts/   doctor.mjs    preflight, free connectivity check (+ SocialCue row)
           gen-image.mjs fal.ai image gen + edit rounds (+OG crop/master)
           cms.mjs       list/create/update/get/upload-image
           socialcue.mjs locate SocialCue, host images, add a content item
scripts/lib/ env, config, fal, models, args, log,
           cms-adapters (3 adapters, shared by cms.mjs + socialcue.mjs),
           socialcue-locate, socialcue-assets
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
   **Vision review** — Claude `Read`s every generated image (its own vision, no
   extra key), gives a one-line verdict against the rubric in the blog-images
   skill, and fixes real defects (dangling cables, sun in a night scene,
   garbled text…) with `gen-image.mjs --edit` (fal `nano-banana-pro/edit`,
   same $0.15) or a regenerate — at most `imageReviewRounds` paid rounds per
   image (default 2, clamp 3), so worst-case spend is `images × (1 + rounds) ×
   $0.15` and is reported against actual. Rounds are kept as `.rN.jpg` files
   and the winner is copied to a canonical name before upload.
3. **Humanize** — between write and images, Claude runs the humanize skill
   (25 numbered AI-writing tells adapted from blader/humanizer and
   Wikipedia's "Signs of AI writing") over the body, title, meta and
   excerpt: mark the tells, rewrite, check that no fact, link, keyword or
   image placeholder moved, final. Voice comes from the site's `voiceSamples`,
   then `directions`, then `toneGuide`. Where humanizer would ask for a
   missing detail, this pass simplifies the sentence instead, so the run
   still asks nothing. The count of tells fixed lands in the run report.
4. **Draft-always** — every run ends as a draft; `cms.mjs create` hardcodes
   `status: "draft"` regardless of input. Publishing is exclusively the
   separate PATCH flip via `/seoblog:publish` (or a prompt that explicitly
   says to publish).

## Writing for SocialCue (/seoblog:socialcue)

[Social Cue](https://trysocialcue.com) keeps a per-project Content Library
(`<project>/.socialdiscovery/socialcue.db`) and posts items from it to Indie
Hackers, dev.to, subreddits etc. through the user's own browser. seoblog acts
as a **producer agent** for it, using SocialCue's documented contract
(`node <socialcue>/lib/cli.js content add -`): one item, `status: draft`,
`source: seoblog`, `format: markdown`, a `notes` line for the poster, and
`media` = the local image files (hero first). SocialCue copies the files into
its store at ingest, so the scratch dir can vanish afterwards.

Three things make this non-trivial:

- **Finding SocialCue from another plugin.** `${CLAUDE_PLUGIN_ROOT}` is
  seoblog's own dir. `scripts/lib/socialcue-locate.mjs` resolves the CLI
  (`socialCue.cliPath` → `$SOCIALCUE_CLI` → newest
  `~/.claude/plugins/cache/*/socialcue/<ver>/lib/cli.js` **whose native
  better-sqlite3 actually loads under the running Node** — cache copies carry
  the node_modules they were built with) and the store (`socialCue.dir` →
  `$SOCIALCUE_DIR` → nearest ancestor of cwd with
  `.socialdiscovery/config.json`; a store is never created implicitly).
- **Images need public URLs.** Indie Hackers has no image upload; dev.to only
  via its editor. The only host seoblog has is the blog CMS, whose upload
  endpoint hangs off an article id. So `socialcue.mjs host-images` creates one
  **asset-holder draft** on the best-fitting site (slug `sc-assets-<post>`,
  tag `socialcue-assets`), uploads the images to it, and returns absolute
  `imageUrl`s for `![alt](url)`. The Articles API serves `/blog/images/:id`
  regardless of post status, so the holder is never published; `cms.mjs list
  --exclude-assets` hides holders from every blog flow. A future
  `POST /api/images` on the servers would make the holder unnecessary — the
  change is local to `socialcue.mjs`.
- **It may ask — twice at most.** Unlike the write flow this command is run
  by a person: it asks which brand when the description doesn't settle it,
  and where to host images when no configured site fits the brand (or offers
  a no-images post). Nothing else.

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
voiceSamples, directions, articleLength, imageReviewRounds, product, shopifyBlogId) +
defaultSite + optional `socialCue` (dir, cliPath, brandBySite). Non-secret,
written by setup.

`~/.config/seoblog/state/<siteId>.json` — articleHistory + keywordQueue +
lastRunAt + socialPosts (what /seoblog:socialcue wrote into SocialCue). This replaces the actor's Apify KV store: dedup across runs, and the
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
