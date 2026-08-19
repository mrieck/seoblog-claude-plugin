<a name="top"></a>

![SEO Blog — Research. Write. Rank.](docs/seoblog_banner.png)

# SEO Blog Claude Plugin

**Your blog deserves fresh, ranking content. Let Claude write it.**

SEO Blog is a [Claude Code](https://claude.com/claude-code) plugin that turns
your terminal into an SEO content team. Claude researches the live SERPs and
your existing articles, finds a topic worth ranking for, writes the piece with
real SEO craft, generates *and looks at* the hero/inline/social images — and publishes it as a
**draft** to your blog. The whole run is autonomous (safe to schedule
off-hours), and nothing goes live until you flip it.

```
/seoblog:write
```

No hosted runtime, no per-run fee — just your Claude subscription and
~$0.15 per fal.ai image call (one per image, plus any fix rounds).

## ✨ What you get

- 🔎 **Real SERP research, not vibes** — live WebSearch + WebFetch of the
  top-ranking competitors before a word is written; People Also Ask mining,
  content-gap discovery, and dedup against your article history *and* your
  live blog.
- 🧠 **Keyword mode or autopilot** — hand it keywords or directions, or run it
  bare and let it drain your keyword queue / discover gaps in your niche.
- ✍️ **SEO craft baked in** — title under 60 chars, meta description 150–160,
  keyword placement rules, LSI weaving, 8th-grade readability, tags, excerpt.
  The checklist your freelancer skims is the spec Claude actually follows.
- 🖼️ **AI images with alt text** — hero, inline, and a 1200×630 OG social
  image via fal.ai; image count scales with your configured article length,
  and the cost lands in the run report.
- 👀 **Claude looks at every image** — each one is reviewed with vision for
  the classic AI tells (cables to nowhere, sun in a night scene, garbled text,
  wrong subject) and fixed with a targeted edit or a regenerate, up to 2 rounds
  per image by default (`imageReviewRounds` in your site config).
- 📥 **Draft-first, always** — every run ends as a draft (it's hardcoded, not
  a convention). Preview on your site, then `/seoblog:publish` flips it live.
- 🔌 **Three CMS targets** — a generic Articles API, WordPress (via the Cue Up
  WP plugin), and Shopify (native Admin API).
- 🛍️ **Product-led mode** — optionally weaves your product into articles where
  it naturally fits, instead of bolting on a pitch.
- ⏰ **Built to run unattended** — the write flow asks zero questions, so it's
  cron-friendly: wake up to a new draft, not to a stuck prompt.
- 🗂️ **Persistent memory per site** — article history and keyword queue live
  in `~/.config/seoblog`, surviving plugin updates.

## 🚀 Install

In Claude Code:

```
/plugin marketplace add mrieck/claude-plugins
/plugin install seoblog@productive-mark
```

(`productive-mark` is the marketplace, hosted in
[mrieck/claude-plugins](https://github.com/mrieck/claude-plugins); `seoblog`
is the plugin's install name — this repo.)

That's it for software — when you run `/seoblog:setup`, a free doctor check
verifies everything (Node 20+, the plugin's two npm packages, connectivity)
and Claude installs anything missing before your first article. Two things
Claude can't do for you:

### 1. Add your fal.ai key (optional — for images)

Image generation runs through [fal.ai](https://fal.ai/dashboard/keys). Store
the key in your macOS Keychain by running this **in your own terminal** (not
through Claude, so the key never touches a transcript):

```bash
security add-generic-password -s seoblog -a FAL_API_KEY -w
```

It prompts for the key without echoing it. Skip this and articles are simply
written without images (~$0.15 per fal call when enabled — one per image,
plus up to 2 review-driven fix rounds each).

Not on Keychain terms? Every other place a key can live is covered in
[HOW_IT_WORKS.md](HOW_IT_WORKS.md#where-keys-live).

### 2. Configure your blog

```
/seoblog:setup
```

A short interview: where your blog lives (Articles API, WordPress, or
Shopify), your niche, tone, article length, and optional product to feature.
It ends with a Keychain one-liner for your blog's API key and a free doctor
check that proves connectivity before you ever burn a run.

## 📝 Commands

| Command | What it does |
|---|---|
| `/seoblog:write [keywords or directions]` | Research → outline → write → images → draft + run report, fully autonomous |
| `/seoblog:publish [slug]` | Flip a draft to published (no slug: lists your drafts) |
| `/seoblog:status` | Health check + article history + keyword queue + pending drafts |
| `/seoblog:setup` | Add or edit a site configuration |

## ✍️ Write your first article

After setup:

```
/seoblog:write best pour over coffee ratio
```

Claude researches what already ranks, self-checks its outline against your
config and history, writes the article, generates the images and reviews
each one with vision (fixing what's off), uploads everything to your blog as a
draft, and hands you a run report with the preview link and image spend. Like what you see?

```
/seoblog:publish best-pour-over-coffee-ratio
```

Run `/seoblog:write` with no arguments and it works the keyword queue — which
is what makes it worth scheduling nightly.

## 🔒 What leaves your machine

- **Search queries and page fetches** to research the topic (WebSearch/WebFetch).
- **Image prompts** to [fal.ai](https://fal.ai) — paid, ~$0.15/call, skipped
  entirely when no `FAL_API_KEY` is set. A review fix round re-uploads the
  generated image itself to fal storage so the edit model can work on it.
- **The finished article + images** to *your* blog's API, authenticated with
  your key.

Keys are read from the environment, the macOS Keychain (service `seoblog`),
or `~/.config/seoblog/config.json` — never written by the plugin, never sent
anywhere but the service they belong to
([details](HOW_IT_WORKS.md#where-keys-live)).

## 🔍 Under the hood

The interesting bits — why there's no MCP server, the autonomous-by-design
invariants, the Articles API contract, the CMS adapter matrix, and everything
about key resolution — live in [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## 📄 License

SEO Blog Claude Plugin is [MIT licensed](LICENSE).

Ported from the Cue Up SEO Blog Writer Apify actor — Claude Code itself is
the agent now, so the hosted runtime (and its per-run fee) is gone.
