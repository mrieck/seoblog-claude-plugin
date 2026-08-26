---
description: Write a platform-native post (Indie Hackers, dev.to…) and drop it into SocialCue's Content Library
---

Use the **social-article** skill to fulfil this request.

$ARGUMENTS

The arguments describe the post you want: the platform (Indie Hackers, dev.to,
Hashnode, a subreddit…), the topic or story, which brand it is for, optional
length (short/medium/long) and "no images" if you don't want any. Everything
else is inferred. Example:

```
/seoblog:socialcue Indie Hackers post: how I shipped Social Cue on my Claude
subscription instead of paying for a social API — lessons, numbers I actually have
```

Before anything else:

1. Check the environment: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"`.
   If no site is configured, stop and point at /seoblog:setup. Then locate
   SocialCue: `node "${CLAUDE_PLUGIN_ROOT}/scripts/socialcue.mjs" locate`. If it
   returns `ok:false`, report its `error`/`fix` verbatim and stop — this
   command needs the SocialCue plugin and a `.socialdiscovery/` store.
2. This is NOT the unattended blog flow: you may ask the user **at most two
   things**, and only at the gates the skill names — which brand when the
   description doesn't settle it, and where to host images when no configured
   site fits the brand. Never ask anything else (no outline approval, no
   spend approval, no "proceed?").

Then follow the skill: locate → interpret → dedup + research → write markdown
→ images (bucket → generate → review → host) → hand off to SocialCue → record
→ report. seoblog never posts anywhere: the item lands as a **draft** in
SocialCue's Content Library and the user posts it with
`/socialcue:socialcue-post`.
