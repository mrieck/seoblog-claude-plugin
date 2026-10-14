---
name: seoblog-humanize
description: Rewrite an existing SEO Blog draft by id or slug to remove AI writing tells without changing its facts, links or images, or list drafts when no target is supplied.
---

# Humanize an existing blog draft

Read [runtime instructions](../../references/runtime.md) before running scripts.

Use the [humanize](../humanize/SKILL.md) skill to do the rewrite and the
[blog-publish](../blog-publish/SKILL.md) skill for the `cms.mjs` mechanics.

Use the user's request as the arguments.

Arguments may name a draft by slug or id, optionally with a site
(`--site <id>`); otherwise use defaultSite. Running this command with a target
IS the rewrite instruction: do it immediately, without asking for
confirmation. If arguments are empty, list current drafts
(`cms.mjs list --status draft --exclude-assets`) with their titles and
live-URLs-to-be, then stop; the user re-runs with a slug or id. Drafts with
slug `sc-assets-*` are SocialCue image holders: never list or rewrite them;
if one is named as the target, refuse and say why.

Steps:

1. Run the blog preflight (`doctor.mjs --workflow blog --site <id> --text-only`).
2. Resolve the target. An id is used as is. A slug is matched against
   `cms.mjs list --site <id> --exclude-assets` (any status; a published
   article may be humanized too, and it stays published).
3. Fetch the full article with `cms.mjs get --site <id> --id N`. `get` exists
   for the articles-api adapter only; for wordpress or shopify, say that the
   adapter has no single-article read yet and stop.
4. Read the site's `voiceSamples`, `directions` and `toneGuide` from
   config.json, then run the humanize skill's full process (mark, draft,
   check, final) on `body`, `title`, `metaDescription` and `excerpt`. Leave
   `<img>` tags, links, code and the tag list untouched. Never ask the user
   anything; if a sentence needs a detail you do not have, simplify it.
5. Write the patch to the session scratch directory as JSON holding only the
   fields that changed (`body`, `title`, `metaDescription`, `excerpt`), never
   `status`, and apply it with `cms.mjs update --site <id> --id N --file patch.json`.
   If nothing needed changing, say so and skip the update.
6. Report: the article's title and live URL, the humanize report line
   (`humanize: N tells fixed (strongest: …)`), and the single strongest
   before/after pair in 3 to 5 lines. Do not update the state file; the
   article record already exists and its status has not changed.
