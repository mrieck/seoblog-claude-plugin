# seoblog — an SEO blog-writing agent for Claude Code

Write and publish SEO-optimized blog articles from your terminal. Claude
researches the SERPs and your existing content, proposes a topic and outline,
writes the article, generates hero/inline/OG images with fal.ai, and publishes
a **draft** to your blog — you approve every gate, and nothing goes live until
you say so.

Ported from the Cue Up SEO Blog Writer Apify actor; Claude Code itself is the
agent, so there's no hosted runtime, no per-run fee — just your Claude
subscription and ~$0.15 per generated image.

## Features

- **Keyword mode or auto-discover** — give it keywords, or let it find gaps in
  your niche via live SERP research (People Also Ask, competitor analysis).
- **Real research** — WebSearch + WebFetch of top-ranking competitors before a
  word is written; dedup against your article history and live blog.
- **SEO craft baked in** — title <60 chars, meta description 150–160 chars,
  keyword placement rules, LSI weaving, 8th-grade readability, tags, excerpt.
- **AI images with alt text** — hero, inline, and a 1200×630 OG social image
  via fal.ai (`nano-banana-pro`), with a cost estimate you approve first.
- **Draft-first publishing** — posts land as drafts; preview them on your site,
  then `/seoblog:publish` flips them live.
- **Three CMS targets** — the generic Articles API, WordPress (via the Cue Up
  WP plugin), and Shopify (native Admin API).
- **Product-led mode** — optionally weave your product into articles naturally.
- **Persistent memory** — article history + keyword queue per site, surviving
  plugin updates.

## Install

```
/plugin marketplace add mrieck/seoblog-claude-plugin
/plugin install seoblog
```

Then two manual steps:

1. **fal.ai key** (optional, for images) — in your own terminal:
   ```
   security add-generic-password -s seoblog -a FAL_API_KEY -w
   ```
2. **Configure your blog** — run `/seoblog:setup` and follow the interview.
   It ends with a command like
   ```
   security add-generic-password -s seoblog -a "site:myblog" -w
   ```
   for your blog's API key, and a doctor check that proves connectivity.

## Commands

| Command | What it does |
|---|---|
| `/seoblog:write [keywords or directions]` | Research → outline (you approve) → write → images (you approve the spend) → draft → review |
| `/seoblog:publish [slug]` | List drafts, preview, flip one to published |
| `/seoblog:status` | Health check + history + keyword queue + drafts |
| `/seoblog:setup` | Add or edit a site configuration |

## What leaves your machine

- Search queries and fetches to research the topic (WebSearch/WebFetch).
- Image prompts to fal.ai (paid, ~$0.15/image, only after you approve).
- The finished article + images to **your** blog's API, authenticated with your
  key.

Keys are read from the environment, the macOS Keychain (service `seoblog`), or
`~/.config/seoblog/config.json` — never written by the plugin, never sent
anywhere but the service they belong to. See HOW_IT_WORKS.md for architecture.

## License

MIT
