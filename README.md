<a name="top"></a>

![SEO Blog — Research. Write. Rank.](docs/seoblog_banner.png)

# SEO Blog for Codex and Claude Code

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
- 📣 **Writes for Indie Hackers & dev.to too** — `/seoblog:socialcue` writes an
  original, platform-native markdown post (with hosted, vision-reviewed
  images) straight into the [Social Cue](https://trysocialcue.com) plugin's
  Content Library, where `/socialcue-post` posts it from your own browser.

## 🚀 Install

For Codex, follow [Codex setup](#codex-setup) below. The slash commands in the
Claude walkthrough are Claude shortcuts; Codex uses the installed skills or
natural-language requests.

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
| `/seoblog:socialcue <describe the post>` | Write an original Indie Hackers / dev.to / Reddit post in markdown, host its images on your blog, and drop it into SocialCue's Content Library as a draft (needs the Social Cue plugin) |

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

## 📣 Write for Indie Hackers, dev.to and friends

If you also run the [Social Cue](https://trysocialcue.com) plugin, seoblog can
be its writer:

```
/seoblog:socialcue Indie Hackers post: how I built my plugin on the Claude subscription instead of paying for an API
```

Claude writes an **original**, platform-native markdown post (not a repost of
a blog article), generates and vision-reviews the images, hosts them on the
configured blog site that best fits the brand (Indie Hackers can't upload
images, so they need public URLs — they live in a hidden draft your blog
flows ignore), and drops the post into SocialCue's Content Library as a draft.
From there `/socialcue:socialcue-post "<title>" to indiehackers` posts it from
your own browser, with a review stop before anything is submitted. It asks at
most two questions: which brand (if unclear) and where to host images (if no
site fits).

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

## Codex setup

From a clone, register the **repository root**, not `plugins/seoblog`:

```bash
codex plugin marketplace add /absolute/path/to/checkout
codex plugin add seoblog@seoblog-local
```

Start a new thread and ask “Use seoblog-setup to configure my blog.” The other
entry points are `seo-blog` (write), `seoblog-status`, `seoblog-publish`, and
`social-article` (SocialCue library draft). Select the installed skill in Codex
or name it in your request. No separate model API key or MCP server is needed;
Codex writes the article and the bundled Node scripts handle integrations.

Use Node 20+ and enable web research for researched articles. Visual image
inspection is required when images are included. For FAL images, install the
locked dependencies in the **resolved installed plugin directory**:

```bash
npm ci --prefix /absolute/path/to/installed/seoblog
```

The setup skill and doctor report the correct directory. Installing only in the
source checkout does not populate a separately installed cache. Text-only blog
and SocialCue workflows need no image packages. If the host requires a different
image tool, its rules take precedence; report that provider's actual costs.

Configure credentials in your own terminal, never paste them into an agent chat.
On macOS, use the Keychain commands above. On other systems, supply `FAL_API_KEY`
(optional) and `SEOBLOG_SITE_<NORMALIZED_ID>_API_KEY` in the environment inherited
by Codex; for site `my-blog`, the latter is `SEOBLOG_SITE_MY_BLOG_API_KEY`.
An app launched separately may not inherit exports from a terminal.

Configuration and history remain in `~/.config/seoblog` (or beneath
`XDG_CONFIG_HOME` when set), shared with Claude. Keep credentials and user data
outside the plugin cache. Normal filesystem/network permissions still apply.
An unattended write needs preconfigured access and stops with a concrete fix
if setup or required capabilities are missing.

### SocialCue from Codex

SocialCue is a separate dependency. An existing Claude installation is discovered
automatically. Without Claude, install SocialCue's dependencies in its own
checkout and configure `socialCue.cliPath` to its absolute `lib/cli.js` path.
Set `socialCue.dir` to an existing `.socialdiscovery` store, or run from that
project so discovery can walk up from the current directory. The equivalent
overrides are `SOCIALCUE_CLI` and `SOCIALCUE_DIR`.

No browser connection is required to save a library draft. Text-only SocialCue
posts need neither a blog site nor FAL credentials. Image hosting additionally
requires a configured CMS. SEO Blog does not create a replacement SocialCue
store, schedule posts, or publish them to social platforms.

### Diagnostics and updates

Run these against the resolved plugin directory:

```bash
node /path/to/seoblog/scripts/doctor.mjs --workflow blog --site my-blog --text-only
node /path/to/seoblog/scripts/doctor.mjs --workflow socialcue --text-only
node /path/to/seoblog/scripts/doctor.mjs
```

`--workflow blog` validates the requested/default/only site; `--workflow socialcue`
requires SocialCue and skips CMS checks. `--text-only` makes image dependencies
optional even when a FAL key exists. With no workflow flag, doctor retains its
setup/status role and checks configured sites. JSON output remains `{ok, checks}`.

After pulling a release, reinstall with `codex plugin add seoblog@seoblog-local`
and start a new thread. For local development of an unchanged release version,
use plugin-creator's cachebuster helper to refresh the Codex manifest version
before reinstalling. Recheck image dependencies in the new installation.

Run `npm test --prefix plugins/seoblog` from the repository root for isolated
compatibility tests; these use mocked CMS/SocialCue integrations and no paid calls.
