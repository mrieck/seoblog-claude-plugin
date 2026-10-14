---
name: seo-writing
description: >-
  Outline and write an SEO-optimized blog article in HTML: title and meta
  description rules, keyword placement, heading structure, length targets,
  and image placeholders. Use when outlining or drafting
  blog article content, or fixing SEO issues in an existing draft.
---

Read [runtime instructions](../../references/runtime.md) before running scripts.

# SEO writing

## Outline first

1. **Title** — SEO-optimized, includes the primary keyword, **under 60 characters**.
2. **Target word count** — from the site's articleLength:

   | length | min | target | max |
   |---|---|---|---|
   | short | 300 | 500 | 700 |
   | medium | 700 | 1200 | 1500 |
   | long | 1500 | 2000 | 2500 |

3. **H2/H3 structure** — plan every heading before writing.
4. **Key points per section** — what each section must cover.
5. **Internal links** — note existing articles on the site this one should
   reference (you have the live list from ANALYZE; link to them with their real
   URLs where relevant).
6. **Product angle** (product sites only) — where and how the product fits naturally.

## HTML format rules

- `<h2>`/`<h3>` for sections — **never `<h1>`** (the CMS renders the title as h1).
- `<p>` paragraphs, `<ul>`/`<ol>` lists, `<blockquote>` for callouts,
  `<strong>`/`<em>` for emphasis, `<a href="…">` to cite sources.
- No `<html>`/`<head>`/`<body>` wrappers, no inline styles, no CSS classes.
- **No `<img>` tags** — place `<!-- IMAGE: description of ideal image -->`
  comments where images belong (after relevant section headings); they are
  swapped for real images after the draft is created.

## SEO guidelines

- Primary keyword naturally in the **first paragraph** and **at least one H2**.
- Related/LSI keywords throughout — naturally, never stuffed.
- Open with the reader's problem or the post's specific claim, keyword
  included. No run-up ("Let's dive in"), no rhetorical question, no "In this
  guide we'll cover".
- Short paragraphs (2–4 sentences); 8th-grade reading level.
- Actionable insights and specific examples, not abstract filler.
- Close only if the closing adds something: a next step, a decision rule, or a
  real call to action on a product site. Otherwise end on the last concrete
  fact. Never "In conclusion", never a one-line send-off.
- **Meta description**: 150–160 characters, includes the primary keyword.
- **Excerpt**: 1–2 sentence summary for listing cards.
- **Tags**: 3–7 relevant topic tags.
- Answer the searcher's intent directly; back claims with cited sources.

## Write like a person

The draft gets a full review in the [humanize](../humanize/SKILL.md) skill
after WRITE, but write it clean the first time. These apply to HTML articles
and platform markdown alike. Match the site's `voiceSamples` when it has them.

- **Say the thing.** No "it's not X, it's Y" contrasts. The negative half
  names something nobody claimed.
- **No one-line closers.** No "That's the real win." or "Let that sink in."
  after a paragraph, and no row of fragments ("No setup. No config.").
- **No run-up.** No "Let's dive in", "Here's the thing", "Honestly?".
- **No arguing with no one.** No "I'm not saying…", "To be clear…",
  "Some might say… but".
- **No forced triads.** Use the number of items the meaning has.
- **No dashes.** No em or en dashes in the output unless a voice sample uses
  them. Commas, periods, colons and parentheses do the job.
- **Plain words.** No delve, leverage, seamless, robust, game-changer,
  unlock, elevate, crucial, landscape, in today's fast-paced world, or the
  rest of the humanize §12 and §16 lists.
- **Sentence-case headings**, no emojis, and the first sentence under a
  heading must not repeat the heading.
- **Bold only on terms the reader will scan for.** Never bold list labels;
  each `<li>` is a sentence.
- **Use is, are and has** instead of "serves as", "boasts", "features", "offers".

## Product-led content (only when the site has a product)

- The article must stand on its own — the product mention is a bonus, not the point.
- Earn trust with real value before introducing the product; link where it fits
  naturally; vary the approach (brief mention vs. deeper integration).

## Image placeholders

- Write each `<!-- IMAGE: … -->` as a concrete brief — it becomes the seed of
  the image prompt.
- The **hero brief names a concept**: one literal, specific scene drawn from
  the post's central idea, metaphor, villain or joke (a ban hammer mid-swing
  for a post about getting banned; a squirrel burying acorns in three spots
  for a backup post). **Never** a person at a laptop, a tidy desk with coffee,
  or a glowing screen in a dark room — see blog-images → "Hero: concept
  first". Inline briefs: the concrete idea of *that* section, plus setting and
  mood.
- Prompt craft, the defect-prevention checklist, and the vision review/fix
  loop live in the **blog-images** skill. Every image needs descriptive
  **alt text** (SEO + accessibility), written from what the final image shows.

## Platform-native markdown (for /seoblog:socialcue)

Used by the **social-article** skill. The body is **markdown**, not HTML, and it
is pasted by SocialCue into the platform's editor as-is, so:

- `##`/`###` headings only — no `#` (the platform renders the title), no HTML
  tags, no front matter, no inline styles.
- Short paragraphs (1–3 sentences), lists where they help, `**bold**` sparingly,
  links inline as `[text](url)`, code in fences when relevant.
- Images are `![alt](absolute-url)` on their own line. While drafting, write the
  same `<!-- IMAGE: concrete brief -->` placeholders as blog articles; the
  hero brief goes **first, before the opening paragraph**. They are swapped for
  hosted URLs after generation (never a root-relative path — these platforms
  cannot resolve them).
- Length targets reuse the table above. Titles follow the platform, not the
  SEO rules: conversational, specific, honest — no keyword stuffing, the
  <60-char rule does not apply.
- Same non-negotiables as blog content: no invented numbers, no plagiarism,
  cite what you assert.

Per platform:

- **Indie Hackers** — first-person maker story: what you built, why, what
  happened, what you learned; numbers only when real. Markdown editor, no
  cover-image slot, no image upload (hence hosted URLs). One product link
  near the end, in context. Title reads like a forum post ("How I…", "What I
  learned…", "I shipped X in Y and…"), not a headline.
- **dev.to** — technical, concrete, code where it helps; ≤ 4 tags chosen from
  dev.to's own list. The cover image is uploaded separately by SocialCue from
  `media[0]` — do **not** put the hero URL in the body for dev.to; keep inline
  images in the body. No front matter.
- **Hashnode** — like dev.to; cover from `media[0]`, inline images in body.
- **Reddit / forums** — conversational, disclose that you built it, no
  headings in most subs, **no inline images** (attach `media` instead, only
  where the sub allows), link only where the rules allow. Keep it short.
- **generic** — Indie Hackers rules.
