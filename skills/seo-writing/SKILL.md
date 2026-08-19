---
name: seo-writing
description: >-
  Outline and write an SEO-optimized blog article in HTML: title and meta
  description rules, keyword placement, heading structure, length targets,
  and image placeholders. Use when outlining or drafting
  blog article content, or fixing SEO issues in an existing draft.
---

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
- Compelling hook intro that previews the content.
- Short paragraphs (2–4 sentences); 8th-grade reading level.
- Actionable insights and specific examples, not abstract filler.
- Conclusion with key takeaways or a call to action.
- **Meta description**: 150–160 characters, includes the primary keyword.
- **Excerpt**: 1–2 sentence summary for listing cards.
- **Tags**: 3–7 relevant topic tags.
- Answer the searcher's intent directly; back claims with cited sources.

## Product-led content (only when the site has a product)

- The article must stand on its own — the product mention is a bonus, not the point.
- Earn trust with real value before introducing the product; link where it fits
  naturally; vary the approach (brief mention vs. deeper integration).

## Image placeholders

- Write each `<!-- IMAGE: … -->` as a concrete brief (subject, setting, time of
  day, mood) — it becomes the seed of the image prompt.
- Prompt craft, the defect-prevention checklist, and the vision review/fix
  loop live in the **blog-images** skill. Every image needs descriptive
  **alt text** (SEO + accessibility), written from what the final image shows.
