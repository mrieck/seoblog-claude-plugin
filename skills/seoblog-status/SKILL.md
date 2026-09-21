---
name: seoblog-status
description: Check SEO Blog health, article history, keyword queue, and pending drafts.
---

# SEO Blog status

Read [runtime instructions](../../references/runtime.md) before running scripts.

Report the current seoblog status:

Use the user’s request as the arguments.

1. Run `node "${SEOBLOG_PLUGIN_ROOT}/scripts/doctor.mjs"` and summarize the checks.
2. Read `~/.config/seoblog/state/<siteId>.json` for each configured site (or the
   one named in the arguments): article count, keyword queue with statuses,
   lastRunAt, and `socialPosts` (posts written into SocialCue by
   /seoblog:socialcue — count + last few titles/platforms).
3. List current drafts via `node "${SEOBLOG_PLUGIN_ROOT}/scripts/cms.mjs" list
   --site <id> --status draft --exclude-assets`.
4. Present it compactly; suggest /seoblog:write if the queue has pending
   keywords, /seoblog:publish if drafts are waiting, and note whether
   /seoblog:socialcue is available (the doctor's SocialCue row).
