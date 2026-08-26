/**
 * Bridge to the user's SocialCue plugin — used by /seoblog:socialcue to hand a
 * finished, platform-native post to SocialCue's Content Library.
 *
 *   node scripts/socialcue.mjs locate
 *       → { ok, cliPath, version, storeDir, brands: [{id,name,url,tagline,isActive}],
 *           existingItems: [{id,title,status,source}] }
 *       Finds SocialCue's lib/cli.js and the .socialdiscovery store (see
 *       lib/socialcue-locate.mjs for the resolution order). ok:false + fix when
 *       either is missing — the skill reports that and stops.
 *
 *   node scripts/socialcue.mjs host-images --site <id> --title "…" --file a.jpg [--file b.jpg …]
 *                                          [--alt "…" (one per --file, same order)] [--slug <s>]
 *       → { ok, site, holderId, holderSlug, images: [{file, imageUrl, alt}] }
 *       Creates ONE draft "asset-holder" article on the site (slug sc-assets-*,
 *       tag socialcue-assets — never published, hidden from the blog flows) and
 *       uploads every file to it as an inline image. Returns absolute imageUrls
 *       for use in markdown: ![alt](imageUrl). Indie Hackers cannot upload
 *       images at all and dev.to only via its editor, so hosting is what makes
 *       inline images possible there.
 *
 *   node scripts/socialcue.mjs add --file item.json
 *       → { ok, id, storeDir }
 *       Validates the payload (title, body, absolute+existing media paths) and
 *       runs SocialCue's own `content add` against the located store. item.json
 *       is the producer contract from socialcue's docs/agent-content.md:
 *       { title, body, brandName, status: "draft", source: "seoblog",
 *         format: "markdown", notes, media: ["/abs/file.jpg"] }
 *
 * stdout = one JSON line, stderr = progress (the plugin-wide convention).
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs, requireArg, fail } from "./lib/args.mjs";
import { getSite, readConfig } from "./lib/config.mjs";
import { makeAdapter } from "./lib/cms-adapters.mjs";
import { assetHolderArticle } from "./lib/socialcue-assets.mjs";
import { findSocialCueCli, findSocialCueStore, readSocialCueBrands } from "./lib/socialcue-locate.mjs";
import { main, info, report } from "./lib/log.mjs";

const USAGE =
  "socialcue.mjs locate | host-images --site <id> --title <t> --file <img> [--file …] [--alt …] | add --file item.json";

const INSTALL_FIX =
  "Install SocialCue (/plugin marketplace add mrieck/claude-plugins, then /plugin install socialcue@productive-mark) " +
  'or set "socialCue": {"cliPath": "/abs/path/to/socialcue/lib/cli.js"} in ~/.config/seoblog/config.json';
const STORE_FIX =
  'Run this command from the project that holds your .socialdiscovery/ store, or set "socialCue": {"dir": "/abs/path/.socialdiscovery"} ' +
  "in ~/.config/seoblog/config.json (SocialCue stores are per-project — /socialcue:socialcue-setup creates one)";

function locate(config) {
  const cli = findSocialCueCli(config);
  if (!cli || cli.error) {
    // A probe error already says what to do; only the not-installed case needs the generic fix.
    return { ok: false, error: cli?.error ?? "SocialCue plugin not found", fix: cli?.error ? "" : INSTALL_FIX };
  }
  const store = findSocialCueStore(config);
  if (!store || store.error) {
    return { ok: false, error: store?.error ?? "No SocialCue store found", fix: STORE_FIX, cliPath: cli.cliPath, version: cli.version };
  }
  return { ok: true, cliPath: cli.cliPath, version: cli.version, cliSource: cli.source, storeDir: store.storeDir, storeSource: store.source };
}

/** Run SocialCue's CLI against the located store; returns trimmed stdout. */
function runSocialCue(loc, args, { input } = {}) {
  return execFileSync(process.execPath, [loc.cliPath, ...args], {
    env: { ...process.env, SOCIALCUE_DIR: loc.storeDir },
    cwd: path.dirname(loc.storeDir),
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 60_000,
  }).trim();
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    throw new Error(`Could not read JSON from ${file}: ${e.message}`);
  }
}

await main(async () => {
  const [cmd] = process.argv.slice(2);
  const args = parseArgs(process.argv.slice(3), { multi: ["file", "alt"] });
  if (!cmd) fail("missing command", USAGE);
  const config = readConfig();

  switch (cmd) {
    case "locate": {
      const loc = locate(config);
      if (!loc.ok) {
        report(`SocialCue: ${loc.error}`, loc);
        process.exit(1);
      }
      info(`  SocialCue ${loc.version ?? "?"} at ${loc.cliPath} (${loc.cliSource})`);
      info(`  store ${loc.storeDir} (${loc.storeSource})`);
      const brands = readSocialCueBrands(loc.storeDir);
      let existingItems = [];
      try {
        const rows = JSON.parse(runSocialCue(loc, ["content", "list", "--json", "--limit", "200"]));
        existingItems = rows.map((r) => ({ id: r.id, title: r.title, status: r.status, source: r.source, brandName: r.brand_name }));
      } catch (e) {
        info(`  warning: could not list existing content items: ${String(e.message).split("\n")[0]}`);
      }
      report(`${brands.length} brand(s), ${existingItems.length} existing content item(s)`, {
        ...loc,
        brands,
        brandBySite: config.socialCue?.brandBySite ?? {},
        existingItems,
      });
      break;
    }

    case "host-images": {
      const title = requireArg(args, "title", USAGE);
      const files = args.file ?? [];
      if (!files.length) fail("need at least one --file", USAGE);
      for (const f of files) if (!existsSync(f)) throw new Error(`image not found: ${f}`);
      const alts = args.alt ?? [];
      const { id: siteId, site } = getSite(args.site ?? null);
      const adapter = makeAdapter(siteId, site);

      const holder = assetHolderArticle(title, { slug: args.slug, author: site.author });
      info(`  creating asset-holder draft "${holder.slug}" on ${siteId}`);
      const created = await adapter.create(holder);
      const images = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const alt = alts[i] || undefined;
        const buf = await readFile(file);
        const { imageUrl } = await adapter.uploadImage(created.id, buf, path.basename(file), { purpose: "inline", alt });
        info(`  hosted ${path.basename(file)} → ${imageUrl}`);
        images.push({ file, imageUrl, alt: alt ?? null });
      }
      report(`Hosted ${images.length} image(s) on ${siteId} (holder draft ${created.id})`, {
        ok: true,
        site: siteId,
        holderId: String(created.id),
        holderSlug: created.slug ?? holder.slug,
        images,
      });
      break;
    }

    case "add": {
      const file = requireArg(args, "file", USAGE);
      const item = await readJsonFile(Array.isArray(file) ? file[0] : file);
      if (!item.title || !item.body) throw new Error("item.json needs title and body");
      const media = Array.isArray(item.media) ? item.media.map(String) : [];
      for (const m of media) {
        if (!path.isAbsolute(m)) throw new Error(`media path must be absolute: ${m}`);
        if (!existsSync(m)) throw new Error(`media file not found: ${m}`);
      }
      const loc = locate(config);
      if (!loc.ok) {
        report(`SocialCue: ${loc.error}`, loc);
        process.exit(1);
      }
      const payload = {
        status: "draft",
        source: "seoblog",
        format: "markdown",
        ...item,
        media,
      };
      // The payload goes over stdin, never argv — a markdown body is far too big
      // for a command line and zsh's echo would mangle it anyway.
      const id = runSocialCue(loc, ["content", "add", "-"], { input: JSON.stringify(payload) });
      if (!id) throw new Error("SocialCue content add printed no id");
      report(`Added SocialCue content item ${id} (${payload.status}, ${media.length} media)`, {
        ok: true,
        id,
        storeDir: loc.storeDir,
        status: payload.status,
      });
      break;
    }

    default:
      fail(`unknown command "${cmd}"`, USAGE);
  }
});
