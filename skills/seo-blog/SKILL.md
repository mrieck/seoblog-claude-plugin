---
name: seo-blog
description: >-
  Research, write and publish an SEO-optimized blog article end-to-end:
  topic selection, SERP/competitor research, outline, HTML article, AI-generated
  hero/inline/OG images, and draft-first publishing to the configured blog. Use
  when the user asks to "write a blog post", "write an SEO article", "publish to
  my blog", "add a post to the blog", or runs /seoblog:write. Also holds the
  setup interview for /seoblog:setup and the config/state file schemas.
---

# SEO blog writing — the orchestrator

You write exactly **ONE article per invocation**, walking these phases in order:

```
analyze → select topic → research → outline → write
        → images → publish draft → report
```

This flow is fully autonomous — it runs unattended (e.g. scheduled off-hours),
so it must complete without ever asking the user anything.

Per-phase craft lives in three sibling skills — load them as you reach each phase:
- **seo-research** — topic selection, SERP analysis, competitor deep-dives, LSI keywords
- **seo-writing** — outline + article craft: HTML rules, keyword placement, length targets
- **blog-publish** — script mechanics: create/update/upload via `cms.mjs`, image workflow

## Files you read and edit directly

There is no state server — you own these files with Read/Edit/Write:

**Config** `~/.config/seoblog/config.json` (non-secret; secrets NEVER go here):

```json
{ "defaultSite": "plugmyplugin",
  "sites": { "plugmyplugin": {
    "baseUrl": "https://plugmyplugin.com",
    "cmsType": "articles-api",          // articles-api | wordpress | shopify
    "author": "Mark Rieck",
    "niche": "Claude Code plugins and AI dev tooling",
    "toneGuide": "Professional and approachable",
    "directions": "",                    // standing house rules, appended to every run
    "articleLength": "medium",           // short | medium | long
    "product": null,                     // or {productUrl, productName, tagline, shortDesc, longDesc?, productTags?}
    "shopifyBlogId": null } } }
```

**State** `~/.config/seoblog/state/<siteId>.json` — memory across runs:

```json
{ "articleHistory": [{ "id": "12", "slug": "…", "title": "…", "keywords": ["…"],
                       "status": "draft", "wordCount": 1200, "createdAt": "<iso>" }],
  "keywordQueue":   [{ "keyword": "…", "status": "pending|in-progress|completed",
                       "articleId": null }],
  "lastRunAt": "<iso>" }
```

API keys are NEVER written by you or any script — the user stores them in their
own terminal (Keychain service `seoblog`). See Setup below.

## Phase order in detail

1. **ANALYZE** — read the state file, then `node "${CLAUDE_PLUGIN_ROOT}/scripts/cms.mjs" list --site <id>`
   (the key is sent on GET, so drafts come back too). Build a map of covered
   topics, gaps, and topical clusters. **Dedup rule:** if the topic/keyword is in
   the article history OR similar content exists live, skip it and pick another.
2. **SELECT TOPIC** — keyword mode (user gave keywords: first = primary, rest =
   secondary/LSI, ONE article for all of them; mark them in-progress in the
   state file) or auto-discover (no keywords: drain the state keywordQueue first;
   if empty, research trending topics/gaps — see seo-research). Stay on the
   site's declared niche.
3. **RESEARCH** — per seo-research. WebSearch SERPs, WebFetch 2–3 competitors,
   find the angle. If the site has a `product`, WebFetch the product URL too.
   If research reveals the topic is too thin for a good article, say so and pick
   another — quality over quantity.
4. **OUTLINE — self-check.** Draft the outline: chosen topic + why (including
   the dedup check result), title (<60 chars, primary keyword), H2/H3 outline,
   target word count, planned image spots, product angle if any. Validate it
   yourself — dedup passed, title fits, H2/H3s cover the search intent, word
   count matches the site's articleLength — fix what fails, then proceed
   immediately. Never ask the user to approve it.
5. **WRITE** — per seo-writing. Full HTML body with `<!-- IMAGE: … -->`
   placeholders (no `<img>` yet), meta description, excerpt, 3–7 tags.
6. **IMAGES.** Compute the image count from the blog-publish table, note the
   cost ("N images × $0.15 = $X via fal.ai") in your progress output for the
   record, and generate immediately — no approval step. If FAL_API_KEY is
   unset, publish without images and strip the placeholders.
7. **PUBLISH DRAFT** — per blog-publish: create with `status:"draft"` (ALWAYS
   draft, never publish directly), generate + upload images, swap placeholders,
   update the state file (record article, mark keywords completed, set lastRunAt).
8. **REPORT.** The article stays a **draft** — that is the terminal state.
   Report: draft id, slug, live-URL-to-be (`<baseUrl>/blog/<slug>`), image
   count and cost spent. Previewing drafts is the site's job — point the
   user at whatever their site provides (e.g. plugmyplugin.com shows drafts at
   the live URL to signed-in admins); never construct a preview-key URL.
   Note that /seoblog:publish flips it live later. Only flip to published in
   this same run (`cms.mjs update --id N` with `{"status":"published"}`) if the
   user's original prompt explicitly asked to publish — never ask.

## Critical rules

1. **ALWAYS DRAFT first** — never create with status published.
2. **ALWAYS RECORD** — update the state file after creating an article.
3. **NEVER PLAGIARIZE** — research is for understanding what exists; write original content.
4. **ONE ARTICLE PER RUN.**
5. **NEVER ASK QUESTIONS during a write run** — no AskUserQuestion, no
   free-text confirmations ("proceed?", "is this OK?"). Runs are often
   scheduled and unattended; a question means the run fails. Compute the
   image count from the table and proceed; end at draft and report.
6. Respect the site's `directions` field as standing house rules on every run.

## Setup interview (for /seoblog:setup)

Use AskUserQuestion to collect, then write config.json (Write/Edit is fine —
it holds no secrets):

1. Site id (short slug), baseUrl, cmsType (articles-api / wordpress / shopify;
   wordpress uses the same wire contract via the Cue Up WP plugin; shopify needs
   a Custom App token with write_content and optionally shopifyBlogId).
2. Author name and niche (both required).
3. Tone guide + default article length (short ~500 / medium ~1200 / long ~2000 words).
4. Optional product for product-led content (productUrl, productName, tagline, shortDesc).
5. Optional standing directions.

Then print the exact commands for the user to run **in their own terminal**
(keys must never pass through your tool calls):

```
security add-generic-password -s seoblog -a FAL_API_KEY -w
security add-generic-password -s seoblog -a "site:<siteId>" -w
```

Finish with `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --site <id>` and fix
anything red. Doctor's connectivity check is free and proves the key works.
