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
   If no site is configured, run the setup interview from the seo-blog skill
   first. Fix any failing required check or tell the user exactly what to run.
2. Never generate images before the user approves the cost estimate, and never
   create an article with any status but "draft".

Then follow the skill: analyze → topic → research → outline (approve) → write →
images (approve spend) → publish draft → review (approve publish or keep draft).
