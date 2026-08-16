---
description: Configure a blog site for seoblog (interview + key storage + doctor)
---

Use the **seo-blog** skill's *Setup interview* section to fulfil this request.

$ARGUMENTS

1. Interview the user (AskUserQuestion) for: site id, baseUrl, cmsType,
   author, niche, tone, default article length, optional product, optional
   standing directions.
2. Write the config to `~/.config/seoblog/config.json` (non-secret — never put
   API keys in it). Set defaultSite if it's the first site.
3. Print the exact `security add-generic-password` commands for the user to run
   themselves in their own terminal — never accept a key pasted into the chat,
   and never write one from a tool call.
4. Verify with `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --site <id>` and
   walk through fixing anything that fails.
