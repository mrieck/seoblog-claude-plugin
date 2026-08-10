---
description: Show seoblog health, article history, keyword queue and current drafts
---

Report the current seoblog status:

$ARGUMENTS

1. Run `node "$CLAUDE_PLUGIN_ROOT/scripts/doctor.mjs"` and summarize the checks.
2. Read `~/.config/seoblog/state/<siteId>.json` for each configured site (or the
   one named in the arguments): article count, keyword queue with statuses,
   lastRunAt.
3. List current drafts via `node "$CLAUDE_PLUGIN_ROOT/scripts/cms.mjs" list
   --site <id> --status draft`.
4. Present it compactly; suggest /seoblog:write if the queue has pending
   keywords, /seoblog:publish if drafts are waiting.
