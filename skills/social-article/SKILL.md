---
name: social-article
description: >-
  Write an original, platform-native article (Indie Hackers, dev.to, Hashnode,
  a subreddit) in markdown, with AI-generated, vision-reviewed images hosted on
  one of the user's configured blog sites, and hand it to the SocialCue plugin
  as a Content Library item for the user to post. Use when the user runs
  /seoblog:socialcue or asks to "write a post for Indie Hackers / dev.to and
  put it in SocialCue". Not for reposting blog articles — this writes new,
  non-duplicated content.
---

Read [runtime instructions](../../references/runtime.md) before running scripts.

# Social article — write for SocialCue

You write exactly **ONE post per invocation** and hand it to SocialCue. The
post is **original content for that platform** — not a canonical blog article
reposted somewhere else. If a similar blog article already exists on the
user's site, that is a reason to pick a different angle, not to reuse it.

```
locate → interpret → dedup + research → write (markdown)
       → images (bucket → generate → review → host) → hand off → record → report
```

Run the SocialCue preflight from the runtime instructions first. Honor the
user's topic, length, platform, and voice samples. A request for a draft only
in chat stops before the library handoff. Missing CMS configuration does not
block text-only drafts: skip live-blog dedup if no matching site is usable and
report that limitation. Never invent first-person experiences.

Craft lives in sibling skills — load them as you reach each phase:
- **seo-writing** → section "Platform-native markdown" (format + per-platform rules)
- **seo-research** → light research only (2–3 fetches; credibility, not SERP ranking)
- **blog-images** → generate → Read → fix-round loop (used verbatim)

Scripts (stdout = one JSON line, stderr = progress):

```
node "${SEOBLOG_PLUGIN_ROOT}/scripts/socialcue.mjs" locate
node "${SEOBLOG_PLUGIN_ROOT}/scripts/socialcue.mjs" host-images --site <id> --title "…" --file <img> [--file …] [--alt "…" …]
node "${SEOBLOG_PLUGIN_ROOT}/scripts/socialcue.mjs" add --file item.json
node "${SEOBLOG_PLUGIN_ROOT}/scripts/cms.mjs" list --site <id> --exclude-assets
node "${SEOBLOG_PLUGIN_ROOT}/scripts/gen-image.mjs" …   (per blog-images)
```

## The two questions you may ask

This flow is interactive but frugal. You may use AskUserQuestion **only** for:

1. **Brand** — when the description names no brand and neither the brand list
   nor the site config settles it (see INTERPRET).
2. **Image bucket** — when no configured site fits the brand (see IMAGES).

Nothing else. No outline approval, no cost approval, no "shall I proceed".
Both questions are asked at most once, and only if actually needed.

## Phases

1. **LOCATE** — `socialcue.mjs locate` → `{cliPath, version, storeDir, brands,
   brandBySite, existingItems}`. `ok:false` → print `error` + `fix`, stop.
   Also read `~/.config/seoblog/config.json` (sites) and the site state files
   (`socialPosts` = what this command wrote before).

2. **INTERPRET** the description into:
   - **platform**: `indiehackers` | `devto` | `hashnode` | `reddit` (with the
     sub) | `generic`. Default **indiehackers** when unstated.
   - **brand**: a brand from `brands` named in the description (case-insensitive,
     partial match on `name`); else `brandBySite[<site named in the description
     or defaultSite>]`; else the brand whose `url` host equals a configured
     site's `baseUrl` host when that site is the only/default one; else, if
     exactly one active brand exists, that one. Still ambiguous → **question 1**
     (list the brand names). The brand supplies voice context; the matching
     site's `toneGuide`, `directions` and `product` apply when a site matches.
   - **length**: short / medium / long from the description, else medium.
   - **images**: off if the description says "no images"/"text only".
   - **topic + angle**: what the post is about and the first-person story.

3. **DEDUP + RESEARCH** — Compare the topic to `existingItems` titles (SocialCue
   already has it → pick a new angle and say so in the report) and to the
   matching site's blog (`cms.mjs list --site <id> --exclude-assets`): a live
   article on the same subject means this post must take a **different**
   angle (a maker story, a specific lesson, a number the blog didn't have) —
   never a rewrite. Skip this CMS lookup if no matching site is usable. Then research lightly per seo-research: 2–3 WebSearch /
   WebFetch calls to get facts right and cite what you claim. Product sites:
   WebFetch the product URL. Never invent metrics — say "I don't have numbers
   for that" in the report rather than making them up.

4. **WRITE** — markdown per seo-writing → "Platform-native markdown". Title in
   the platform's idiom, body with `##`/`###` only, short paragraphs, links
   inline, one product link where it earns its place. Place
   `<!-- IMAGE: concrete brief -->` where images belong: the **hero brief
   first, before the first paragraph**, except dev.to/Hashnode covers stay in
   media and Reddit has no inline images (seo-writing takes precedence), and inline briefs after the section
   they illustrate. Image count by length: short 1 hero / 0 inline, medium
   1 / 1, long 1 / 2. **No OG image** — platforms don't use it.

5. **IMAGES** (skip entirely when images are off; if `FAL_API_KEY` is unset,
   skip without asking and warn in the report). If skipping images, strip all
   image placeholders and use `media: []`:

   **Pick the bucket** — the configured site that will host the image files:
   - *fit*: the site's `baseUrl` host equals the brand's `url` host, or
     `brandBySite` maps the site to this brand, or the site's `product.productName`
     / `niche` clearly covers the brand or topic.
   - Exactly one fit → use it. Several → the `baseUrl`/`brandBySite` match wins.
   - **No fit** (only unrelated sites, or no site with a key) → **question 2**:
     one option per usable site ("Host images on <site> anyway — they'll live in
     that blog's image storage as a hidden draft"), plus "Post without images".
     Honour the answer; "without images" → strip the briefs, `media: []`, and
     carry a warning to the report.

   Then **generate and review exactly as blog-images says**: hero `--purpose
   hero` (16:9), inline `--purpose inline`, rounds as `<slug>-<purpose>.rN.jpg`,
   Read every image, fix real defects up to the site's `imageReviewRounds`,
   copy the winner to the canonical `<slug>-hero.jpg` / `<slug>-inline-1.jpg`.
   Keep files in the session scratch dir — SocialCue copies them at hand-off.

   **Host** — one call for all images:
   `socialcue.mjs host-images --site <bucket> --title "<post title>" --file <slug>-hero.jpg --file <slug>-inline-1.jpg --alt "<hero alt>" --alt "<inline alt>"`
   → `{holderId, holderSlug, images: [{file, imageUrl, alt}]}`. This creates one
   hidden draft article (slug `sc-assets-…`, tag `socialcue-assets`) that the
   blog flows ignore; it is never published. Replace each brief with
   `![alt](imageUrl)` — **absolute `imageUrl` only**, never a root-relative path.

6. **HAND OFF** — write `item.json` to the scratch dir (never inline on argv,
   never echo-piped) and run `socialcue.mjs add --file item.json`:

   ```json
   { "title": "<post title>",
     "body": "<the markdown>",
     "brandName": "<exact brand name from locate>",
     "status": "draft",
     "source": "seoblog",
     "format": "markdown",
     "notes": "Written for <platform>. Images hosted on <bucket site> (asset draft #<holderId>, <holderSlug>); hero = media[0]. <angle note / dedup note / no-images warning>",
     "media": ["/abs/<slug>-hero.jpg", "/abs/<slug>-inline-1.jpg"] }
   ```

   `media` holds the local files (hero first) so `/socialcue-post` can upload a
   cover image where a form has that slot; the markdown already carries the
   hosted URLs for inline placement. `add` prints `{id}` — the hand-off is done;
   do not retry after success, including if later history recording fails.
   On an ambiguous failure, inspect the library before attempting another add.

7. **RECORD** — append to `~/.config/seoblog/state/<bucket-or-matching-site>.json`
   only when a matching or hosting site exists. Otherwise skip state recording.
   Append to `socialPosts[]`: `{contentItemId, title, brandName, platform, hostSite,
   assetHolderId, createdAt}` (use the brand's matching site when no images
   were hosted; `hostSite`/`assetHolderId` null then). Keep the other keys intact.

8. **REPORT** — item id + brand + platform; where the images live (site, holder
   id/slug) or the no-images warning; the dedup/angle decision; fal calls made
   and spend vs. worst case; and the next step:
   `/socialcue:socialcue-post "<title>" to <platform>` (review and posting stay
   in SocialCue — seoblog never posts). Mention `/socialcue:load-dashboard` to
   edit the draft first. In Codex, direct the user to the SocialCue dashboard;
   these slash commands are Claude shortcuts, not tools to execute.

## Rules

1. **Original content only** — never repost or lightly rewrite a blog article.
2. **Draft in SocialCue, never posted** — `status: "draft"`; seoblog does not
   schedule, publish or post anywhere.
3. **Never publish the asset holder** — it is image storage, not an article.
4. **Absolute image URLs in the body**; local files in `media`.
5. **Two questions max**, only at the named gates.
6. **Never invent facts or metrics.** Respect the site's `directions`.
