---
name: blog-images
description: >-
  Plan, generate, review and repair blog images (hero/inline/OG) via the
  plugin's gen-image.mjs: image counts and cost, prompt craft with a
  defect-prevention checklist, the vision review rubric, and the autonomous
  edit/regenerate fix loop. Use during the IMAGES phase of a write run, or when
  the user asks to regenerate, fix, or review a blog image.
---

# Blog images — generate, look, fix

Every image is **looked at before it ships**. You are the reviewer: the `Read`
tool renders JPEGs visually, so after each generation you Read the file, judge
it against the rubric below, and spend a bounded number of paid fix rounds on
real defects. The whole loop is autonomous — **never ask the user anything**.

The script (stdout = one JSON line, stderr = progress):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/gen-image.mjs" --prompt "…" --out <file> [--purpose hero|inline|og] [--aspect 16:9|4:3|1:1|3:4|9:16]
node "${CLAUDE_PLUGIN_ROOT}/scripts/gen-image.mjs" --edit <editSource> --prompt "<edit instruction>" --out <new file> [--purpose …]
```

Output: `{ok, mode: "generate"|"edit", path, editSource, width, height, costUsd, purpose}`.
`path` is the file that ships (for og: the 1200×630 crop); `editSource` is what
you pass to the next `--edit` (for og: the uncropped `.src.jpg` master — never
edit the crop). A failed call prints `{ok:false, error}` — treat it as "round
failed, keep the previous round", not as a reason to stop the run.

## Image counts and cost

From the site's `articleLength`, **plus always exactly one OG image** when
images are enabled (`FAL_API_KEY` set):

| length | hero | inline | og |
|---|---|---|---|
| short | 1 | 0 | 1 |
| medium | 1 | 1 | 1 |
| long | 1 | 2 | 1 |

Generate and edit both cost **$0.15 per call** (fal-ai/nano-banana-pro and its
`/edit` sibling; never request 4K). Cost note for your progress output:
`N images × $0.15 = $base; up to R fix rounds each → worst case $max`, where
R = the site's `imageReviewRounds`. Note it and proceed — no approval step.

**Fix-round cap** `imageReviewRounds` (per site in `~/.config/seoblog/config.json`):
absent → **2**; `0` → review and report only, no paid fixes; values above 3 are
treated as 3. One round = one paid call (edit or regenerate). The cap is per
image, so the run's worst case is `images × (1 + R) × $0.15`.

## Prompt craft

- Be specific: subject, style, composition, lighting, mood — "a modern office
  workspace with a laptop showing analytics dashboards, natural lighting from
  large windows, minimalist design" beats "an office".
- Match the article's tone and the site's `toneGuide`; derive visuals from the
  topic, the `<!-- IMAGE: … -->` placeholder text, and the keywords.
- Write **one style anchor sentence** per run (palette, medium, lighting,
  level of realism) and reuse it verbatim in every prompt so hero, inline and
  OG images look like a set.
- **Purpose-specific composition:**
  - hero (16:9): one clear focal point, subject in the central two-thirds
    (themes crop banner edges), calm enough to sit under a title.
  - inline (16:9 or 4:3): illustrates *that* section, not the whole article.
  - og (auto-cropped to 1200×630): bold, simple, high contrast, subject dead
    centre — it must read at thumbnail size and survives both our centre crop
    and the platforms' further cropping.
- **Avoid text in images** — AI-generated text comes out garbled. Ask for
  "no text, letters, logos, labels or watermarks" explicitly.
- Every image needs descriptive **alt text** (SEO + accessibility); write it
  from what the final image actually shows.

### Prevention checklist — write these INTO the prompt

The model has no negative prompt, so state the physics you want as positive
constraints. Include the ones that apply; they are the defects that most often
ship:

- Every cable, cord, pipe or hose **terminates at a device, outlet or fixture**
  at both ends — nothing dangling into the wall or mid-air.
- **Light matches the time of day**: a night scene is lit by moon, screens or
  lamps only — no sun, no daylight through windows; a sunny scene has one sun
  and shadows that agree with it.
- Consistent shadows and reflections; one perspective; nothing floating or
  merging into something else.
- Correct counts: two hands, five fingers, four chair legs, one of each
  object unless the scene calls for more.
- The subject is *literally* about the topic (a post about backups shows
  drives/servers/restore flows, not generic "technology").
- No text, letters, numbers, logos, UI mock-ups, signs or watermarks.

## Review loop — per image

```
round 0 : generate → <slug>-<purpose>.r0.jpg
repeat  : Read the shipped file → verdict → if DEFECT and rounds left:
          edit (localized) or regenerate (fundamental) → .r1.jpg, .r2.jpg …
stop    : PASS, or cap reached → choose the best round → cp to <slug>-<purpose>.jpg
```

1. **Read** the shipped `path` (for og, the cropped file — judge what ships).
2. **Verdict**, one line in your progress output:
   `PASS` or `DEFECT: <what> @ <where> — blocking|minor — fix: edit|regen`.
   Judge against the rubric:
   - physical coherence: cables/pipes go somewhere, light source agrees with
     the time of day, shadows/reflections consistent, nothing floating/merged,
     correct counts of limbs, fingers, objects;
   - no garbled text, logos, watermarks, fake UI;
   - subject and mood match the placeholder and the article;
   - composition fits the purpose (hero focal point central; og subject inside
     the centre and legible as a thumbnail; inline supports its section);
   - no obvious artifacts, blur, duplicated/tiled elements, uncanny faces.
   **Bar:** fix only what a reader would notice at display size. Do not spend a
   round on taste ("I'd prefer warmer light") — every edit re-synthesises the
   frame and can regress something else.
3. **Choose the fix** (only while rounds remain):
   - **Localized defect, rest good → edit.** Precise, minimal instruction that
     names the defect and its location and pins everything else:
     `--edit <editSource> --prompt "Remove the sun and daylight from the window;
     make it a dark night sky with the desk lamp and monitor as the only light
     sources. Keep the composition, subject, colours and everything else
     identical." --out <slug>-<purpose>.r<N>.jpg --purpose <p>`
   - **Fundamental defect → regenerate.** Wrong subject/scene/composition, text
     all over, an og subject that falls outside the crop, or a previous edit
     that failed to fix the same defect: re-run *without* `--edit`, with the
     defect written into the prompt as an explicit positive constraint
     (prevention checklist), `--out <slug>-<purpose>.r<N>.jpg`.
   - Never repeat an identical edit instruction; if an edit did not take,
     escalate to regenerate.
4. **Re-read and compare** with the previous round: is the targeted defect
   gone, and did anything new break? Continue until `PASS` or the cap.
5. **Pick the winner**: the latest round unless it regressed — then the best
   earlier round. Remaining minor defects are acceptable at the cap; list them
   in the run report. Never ask the user.
6. **Canonical copy before upload**: `cp <winner> <slug>-<purpose>.jpg` and
   upload *that* — `cms.mjs upload-image` sends the basename as the filename,
   which can surface in public URLs; `.r1`/`.src` must not leak. Keep all round
   files until the upload succeeds.

Files never overwrite each other: `<slug>-<purpose>.r0.jpg`, `.r1.jpg`, `.r2.jpg`
(+ `<slug>-og.rN.src.jpg` masters), then `<slug>-<purpose>.jpg` for upload.

## Report lines

For each image: purpose, rounds used (e.g. `hero: r0 PASS`, `inline-1: r2 edit
— fixed dangling cable`), then `images: N, calls: M, spent $X (worst case $Y)`
and any defects left at the cap.
