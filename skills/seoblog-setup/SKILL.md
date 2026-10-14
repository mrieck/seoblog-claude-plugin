---
name: seoblog-setup
description: Configure or edit an SEO Blog site, voice (tone guide and voice samples), CMS connection, and optional images.
---

# Set up SEO Blog

Read [runtime instructions](../../references/runtime.md) before running scripts.

Use the [seo-blog](../seo-blog/SKILL.md) skill's *Setup interview* section to fulfil this request.

Use the user’s request as the arguments.

1. Interview the user (AskUserQuestion) for: site id, baseUrl, cmsType,
   author, niche, tone, optional voice samples (1–3 paragraphs of their own
   writing, inline or as file paths, saved as `voiceSamples`), default article
   length, optional product, optional standing directions.
2. Write the config to `~/.config/seoblog/config.json` (non-secret — never put
   API keys in it). Set defaultSite if it's the first site.
3. On macOS, print the exact `security add-generic-password` commands for the user to run
   themselves in their own terminal — never accept a key pasted into the chat,
   and never write one from a tool call.
   On other systems, use the environment-variable instructions in the runtime guide.
4. Verify with `node "${SEOBLOG_PLUGIN_ROOT}/scripts/doctor.mjs" --site <id>` and
   walk through fixing anything that fails.
