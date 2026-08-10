---
description: Review blog drafts and flip an approved one to published
---

Use the **blog-publish** skill to fulfil this request.

$ARGUMENTS

Arguments may name a draft by slug or id; if empty, list current drafts
(`cms.mjs list --status draft`) and ask which one to publish.

Show the draft's title and the live URL it will get (previewing drafts is up to
the site's own admin tooling — don't construct preview URLs), then get
explicit confirmation before flipping status to "published". Afterwards verify
the flip, print the live URL, and update the state file.
