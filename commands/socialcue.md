---
description: Write a platform-native post (Indie Hackers, dev.to…) and drop it into SocialCue's Content Library
---

Read [runtime instructions](../references/runtime.md) before running scripts.

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

Follow the social-article skill and its workflow-specific runtime preflight.
Text-only SocialCue drafts do not require a CMS site or image dependencies.
