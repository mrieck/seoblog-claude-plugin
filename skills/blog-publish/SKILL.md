---
name: blog-publish
description: >-
  Publishing mechanics for blog articles: creating drafts, generating and
  uploading hero/inline/OG images, swapping image placeholders, flipping drafts
  to published, and recording state — all via the plugin's cms.mjs and
  gen-image.mjs scripts. Use when publishing a written article, uploading blog
  images, listing drafts, or when the user runs /seoblog:publish.
---

# Blog publishing mechanics

All remote calls go through two scripts (stdout = one JSON line, stderr = progress):

```
node "$CLAUDE_PLUGIN_ROOT/scripts/cms.mjs" <list|create|update|get|upload-image> --site <id> …
node "$CLAUDE_PLUGIN_ROOT/scripts/gen-image.mjs" --prompt "…" --out <file> [--purpose hero|inline|og]
```

Write article/patch JSON to a temp file first — body HTML never goes on argv.

## Image counts

From the site's articleLength, **plus always exactly one OG image** when
publishing with images enabled:

| length | hero | inline | og |
|---|---|---|---|
| short | 1 | 0 | 1 |
| medium | 1 | 1 | 1 |
| long | 1 | 2 | 1 |

Cost = images × $0.15 (fal-ai/nano-banana-pro). Note this estimate in your
progress output for the record, then proceed — no approval step.

## Publish-draft sequence

1. **Create the draft** — write `article.json` ({title, body, excerpt, author,
   status: "draft", tags, metaDescription}) to a temp dir, then
   `cms.mjs create --site <id> --file article.json` → `{id, slug}`.
   `status` is ALWAYS "draft" here.
2. **Generate images** — for each planned image run
   `gen-image.mjs` with a crafted prompt (see seo-writing's image-prompt craft):
   - hero: `--purpose hero` (16:9)
   - inline: `--purpose inline` (16:9 or 4:3, per placement)
   - og: `--purpose og` (auto-crops to exactly 1200×630)
   Kebab-case, slug-based filenames (e.g. `<slug>-hero.jpg`).
3. **Upload** — per image:
   `cms.mjs upload-image --site <id> --id <articleId> --file <img> --purpose <p> --alt "…"`
   → `{imageUrl, path}`. Alt text is required for hero and inline.
4. **Swap placeholders** — build the patched body: replace each
   `<!-- IMAGE: … -->` with `<img src="<path>" alt="…" />`, matching each image
   to the most relevant placeholder. Use the returned **`path` verbatim** — the
   server decides its form: root-relative on Postgres-backed sites, an absolute
   CDN URL on object-storage-backed sites and Shopify. The hero and OG images are NOT inserted
   into the body — the site renders them from their purpose slots. Then
   `cms.mjs update --site <id> --id <articleId> --file patch.json` with
   `{"body": "…"}`. If images were skipped, strip the placeholder comments the
   same way.
5. **Record state** — update `~/.config/seoblog/state/<siteId>.json`: append to
   articleHistory ({id, slug, title, keywords, status: "draft", wordCount,
   createdAt}), mark the run's keywords "completed" with the articleId, set
   lastRunAt.

## Publish flip (/seoblog:publish)

The write flow ends at draft + report and never asks about publishing; the
flip only happens via /seoblog:publish or when the user's prompt explicitly
said to publish.

- List drafts: `cms.mjs list --site <id> --status draft`.
- Show the user title and live-URL-to-be (`<baseUrl>/blog/<slug>`). Previewing
  drafts is the site's job, not this plugin's — point the user at whatever
  their site provides (e.g. plugmyplugin.com shows drafts at the live URL to
  signed-in admins; WordPress/Shopify have their own draft previews). Never
  construct a preview URL or put the API key in a URL.
- Flip: `cms.mjs update --site <id> --id <articleId> --file patch.json` with
  `{"status": "published"}`.
- Verify with `cms.mjs get --id <articleId>` (articles-api only) and print the
  live URL. Update the article's status in the state file.

## Per-CMS notes

- **articles-api** — the generic contract; plugmyplugin.com implements it,
  including `purpose=og`.
- **wordpress** — same wire contract, served by the Cue Up WordPress plugin
  (NOT the vanilla WP REST API). Behaves identically to articles-api.
- **shopify** — native Admin API. Hero = the article's featured image. Inline
  and OG uploads land in Shopify Files and return CDN URLs; Shopify has no OG
  slot, so mention in the run report that the OG image is in Files and the
  theme controls og:image. `get` is not supported; verify via `list`.
