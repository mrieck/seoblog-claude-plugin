---
description: Research, write and publish one SEO-optimized blog article (draft first)
---

Use the **seo-blog** skill to fulfil this request.

$ARGUMENTS

Arguments are keywords (comma/space separated) and/or free-form directions.
Empty arguments = drain the site's keyword queue; if that is empty too, run
auto-discover mode.

Before anything else:

1. Check the environment: `node "$CLAUDE_PLUGIN_ROOT/scripts/doctor.mjs"`.
   If no site is configured, do NOT start an interview — this command may be
   running unattended. Fail fast: report that setup is missing and that the
   user must run /seoblog:setup, then stop. Same for any failing required
   check you cannot fix yourself: report exactly what to run and stop.
2. Never ask the user any questions during this command — it must complete
   autonomously. Generate the computed image count without asking, and never
   create an article with any status but "draft".

Then follow the skill: analyze → topic → research → outline → write →
images → publish draft → report. The article stays a draft unless the
arguments explicitly said to publish.
