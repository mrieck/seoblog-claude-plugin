---
description: Review blog drafts and flip an approved one to published
---

Use the **blog-publish** skill to fulfil this request.

$ARGUMENTS

Arguments may name a draft by slug or id. Running this command with a target
IS the publish instruction — flip it immediately, without asking for
confirmation. If arguments are empty, list current drafts
(`cms.mjs list --status draft`) with their titles and live-URLs-to-be, then
stop — do not ask which one to publish; the user re-runs with a slug or id.

When flipping: show the draft's title and the live URL it will get (previewing
drafts is up to the site's own admin tooling — don't construct preview URLs),
flip status to "published", verify the flip, print the live URL, and update
the state file.
