---
name: seoblog-publish
description: Publish an explicitly requested SEO Blog draft by id or slug, or list drafts when no target is supplied.
---

# Publish a blog draft

Read [runtime instructions](../../references/runtime.md) before running scripts.

Use the [blog-publish](../blog-publish/SKILL.md) skill to fulfil this request.

Use the user’s request as the arguments.

Arguments may name a draft by slug or id. Running this command with a target
IS the publish instruction — flip it immediately, without asking for
confirmation. If arguments are empty, list current drafts
(`cms.mjs list --status draft --exclude-assets`) with their titles and
live-URLs-to-be, then stop — do not ask which one to publish; the user re-runs
with a slug or id. Drafts with slug `sc-assets-*` are SocialCue image holders:
never list or flip them; if one is named as the target, refuse and say why.

When flipping: show the draft's title and the live URL it will get (previewing
drafts is up to the site's own admin tooling — don't construct preview URLs),
flip status to "published", verify the flip, print the live URL, and update
the state file.
