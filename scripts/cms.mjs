/**
 * CMS client — every remote call the plugin makes to a blog goes through here.
 * One CLI, three adapters (selected by the site's cmsType):
 *
 *   articles-api  the generic Articles API (X-API-Key; implemented by
 *                 plugmyplugin.com and the Cue Up WordPress plugin)
 *   wordpress     alias of articles-api (requires the Cue Up WP plugin, NOT the
 *                 vanilla WP REST API)
 *   shopify       native Shopify Admin API 2024-01 (Custom App token with
 *                 write_content; blog resolved from shopifyBlogId or first blog)
 *
 * Commands (all print one JSON line to stdout, progress to stderr):
 *   node scripts/cms.mjs list         --site <id> [--limit N] [--offset N] [--status draft|published]
 *                                     [--exclude-assets]  (drop SocialCue image-holder drafts, slug sc-assets-*)
 *   node scripts/cms.mjs create       --site <id> --file article.json
 *   node scripts/cms.mjs update       --site <id> --id N --file patch.json
 *   node scripts/cms.mjs get          --site <id> --id N            (articles-api only)
 *   node scripts/cms.mjs upload-image --site <id> --id N --file img.jpg
 *                                     [--purpose hero|inline|og] [--alt "..."]
 *
 * article.json / patch.json shape (create requires title+body):
 *   { "title", "body" (html), "excerpt", "author", "status", "tags": [],
 *     "metaDescription", "slug" }
 *
 * upload-image returns { imageUrl, path } — insert `path` into body HTML
 * verbatim, use `imageUrl` for reporting. The server provides `path` when it
 * can: root-relative on Postgres-backed articles-api sites, an absolute CDN
 * URL on object-storage-backed sites and Shopify. Older articles-api servers
 * return only imageUrl; `path` falls back to its pathname.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, requireArg, fail, boolArg } from "./lib/args.mjs";
import { getSite } from "./lib/config.mjs";
import { makeAdapter } from "./lib/cms-adapters.mjs";
import { isAssetHolder } from "./lib/socialcue-assets.mjs";
import { main, report } from "./lib/log.mjs";

const USAGE = "cms.mjs <list|create|update|get|upload-image> --site <id> [...]";

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    throw new Error(`Could not read JSON from ${file}: ${e.message}`);
  }
}

await main(async () => {
  const [cmd] = process.argv.slice(2);
  const args = parseArgs(process.argv.slice(3));
  if (!cmd) fail("missing command", USAGE);

  const { id: siteId, site } = getSite(args.site ?? null);
  const adapter = makeAdapter(siteId, site);

  switch (cmd) {
    case "list": {
      const articles = await adapter.list({
        limit: args.limit ? Number(args.limit) : undefined,
        offset: args.offset ? Number(args.offset) : undefined,
        status: args.status,
      });
      // SocialCue image-holder drafts (socialcue.mjs host-images) are not blog
      // content — hide them from draft lists and topic dedup on request.
      const filtered = boolArg(args["exclude-assets"], false)
        ? articles.filter((a) => !isAssetHolder(a))
        : articles;
      report(`${filtered.length} article(s)`, { ok: true, articles: filtered });
      break;
    }
    case "create": {
      const article = await readJsonFile(requireArg(args, "file", USAGE));
      if (!article.title || !article.body) throw new Error("article.json needs title and body");
      const created = await adapter.create(article);
      report(`Created ${created.slug} (id ${created.id})`, { ok: true, ...created });
      break;
    }
    case "update": {
      const id = requireArg(args, "id", USAGE);
      const patch = await readJsonFile(requireArg(args, "file", USAGE));
      const updated = await adapter.update(id, patch);
      report(`Updated ${id}`, { ok: true, article: updated });
      break;
    }
    case "get": {
      const id = requireArg(args, "id", USAGE);
      const article = await adapter.get(id);
      report(`Fetched ${id}`, { ok: true, article });
      break;
    }
    case "upload-image": {
      const id = requireArg(args, "id", USAGE);
      const file = requireArg(args, "file", USAGE);
      const buf = await readFile(file);
      const purpose = ["hero", "inline", "og"].includes(args.purpose) ? args.purpose : "inline";
      const result = await adapter.uploadImage(id, buf, path.basename(file), {
        purpose,
        alt: args.alt,
      });
      report(`Uploaded ${purpose} image → ${result.imageUrl}`, { ok: true, purpose, ...result });
      break;
    }
    default:
      fail(`unknown command "${cmd}"`, USAGE);
  }
});
