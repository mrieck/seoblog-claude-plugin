/**
 * Environment preflight. Run before any writing session:
 *
 *   node scripts/doctor.mjs [--site <id>] [--workflow all|blog|socialcue] [--text-only]
 *
 * stdout: one JSON line {ok, checks: [{name, ok, required, detail, fix}]}
 * stderr: human-readable table with remediation hints.
 *
 * Exit 0 iff every REQUIRED check passes. The per-site connectivity check is a
 * zero-cost live GET (1 article) that also proves the API key works. This
 * doubles as the selftest — every check here is free.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, boolArg } from "./lib/args.mjs";
import { loadSecrets, secretSource, siteApiKey, siteKeyEnvName, configPath } from "./lib/env.mjs";
import { readConfig } from "./lib/config.mjs";
import { MAX_REVIEW_ROUNDS } from "./lib/models.mjs";
import { findSocialCueCli, findSocialCueStore, readSocialCueBrands } from "./lib/socialcue-locate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.join(HERE, "..");

const checks = [];
function check(name, ok, { required = true, detail = "", fix = "" } = {}) {
  checks.push({ name, ok: !!ok, required, detail, fix });
}

const args = parseArgs(process.argv.slice(2));
const workflow = args.workflow ?? "all";
const textOnly = boolArg(args["text-only"]);
if (!["all", "blog", "socialcue"].includes(workflow)) {
  check("workflow", false, { detail: "Expected --workflow blog|socialcue|all" });
}
loadSecrets();
const imagesEnabled = !textOnly && !!process.env.FAL_API_KEY;
const setupFix = "Use the seoblog-setup skill (Claude: /seoblog:setup)";

// -- runtime --
const [major] = process.versions.node.split(".").map(Number);
check("node >= 20", major >= 20, {
  detail: `node ${process.versions.node}`,
  fix: "Install Node 20+ (https://nodejs.org)",
});

let depsOk = true;
for (const dep of ["@fal-ai/client", "sharp"]) {
  if (!existsSync(path.join(PLUGIN_ROOT, "node_modules", dep))) depsOk = false;
}
check("npm dependencies installed", depsOk, {
  required: imagesEnabled,
  detail: depsOk ? "" : "node_modules missing @fal-ai/client and/or sharp",
  fix: `npm ci --prefix "${PLUGIN_ROOT}"`,
});

// -- secrets --
const falSource = secretSource("FAL_API_KEY");
check("FAL_API_KEY", !!process.env.FAL_API_KEY, {
  required: false, // articles can ship without images
  detail: falSource ? `from ${falSource}` : "not set — image generation disabled",
  fix: process.platform === "darwin" ? "security add-generic-password -s seoblog -a FAL_API_KEY -w" : "Set FAL_API_KEY in the agent process environment",
});
if (falSource === "plugin .env") {
  check("FAL_API_KEY storage", false, {
    required: false,
    detail: "key lives in the plugin .env — it will be orphaned on plugin update",
    fix: "Move it to the Keychain (see README)",
  });
}

// -- config + sites --
let config = null;
try {
  config = readConfig();
  const n = Object.keys(config.sites).length;
  check("config file", true, {
    required: false,
    detail: n ? `${n} site(s) at ${configPath()}` : "no sites configured yet",
    fix: n ? "" : setupFix,
  });
} catch (e) {
  check("config file", false, { detail: e.message, fix: `Fix or delete ${configPath()}` });
}

const selectedSite = args.site ?? config?.defaultSite ??
  (config && Object.keys(config.sites).length === 1 ? Object.keys(config.sites)[0] : null);
if (workflow === "blog" && config && !selectedSite) {
  check("selected site", false, { detail: "No default or unambiguous site configured", fix: setupFix });
}
let siteIds = [];
if (config && workflow !== "socialcue") {
  siteIds = workflow === "blog"
    ? selectedSite ? [selectedSite] : []
    : args.site ? [args.site] : Object.keys(config.sites);
}
for (const id of siteIds) {
  const site = config.sites[id];
  if (!site) {
    check(`site ${id}`, false, { detail: "not in config", fix: setupFix });
    continue;
  }
  if (!site.baseUrl) {
    check(`site ${id}: baseUrl`, false, { detail: "no baseUrl", fix: setupFix });
    continue;
  }
  if (site.imageReviewRounds !== undefined) {
    const r = site.imageReviewRounds;
    const valid = Number.isInteger(r) && r >= 0 && r <= MAX_REVIEW_ROUNDS;
    check(`site ${id}: imageReviewRounds`, valid, {
      required: false,
      detail: valid ? `${r} fix round(s) per image` : `invalid value ${JSON.stringify(r)} (want integer 0–${MAX_REVIEW_ROUNDS}); skill will clamp`,
      fix: valid ? "" : `Set "imageReviewRounds" to an integer 0–${MAX_REVIEW_ROUNDS} in ${configPath()}`,
    });
  }
  const { key, source } = siteApiKey(id, site);
  check(`site ${id}: API key`, !!key, {
    detail: key ? `from ${source}` : "not found",
    fix: process.platform === "darwin" ? `security add-generic-password -s seoblog -a "site:${id}" -w` : `Set ${siteKeyEnvName(id)} in the agent process environment`,
  });
  if (!key) continue;

  // Zero-cost live check: list one article with the key.
  try {
    if ((site.cmsType || "articles-api") === "shopify") {
      const res = await fetch(
        `${site.baseUrl.replace(/\/$/, "")}/admin/api/2024-01/blogs.json`,
        { headers: { "X-Shopify-Access-Token": key }, signal: AbortSignal.timeout(15_000) },
      );
      check(`site ${id}: connectivity`, res.ok, {
        detail: res.ok ? `${site.baseUrl} reachable, token accepted` : `HTTP ${res.status}`,
        fix: res.ok ? "" : "Check the store URL and Custom App token (write_content scope)",
      });
    } else {
      const url = new URL("/api/articles?limit=1", site.baseUrl);
      const res = await fetch(url, {
        headers: { "X-API-Key": key },
        signal: AbortSignal.timeout(15_000),
      });
      const body = res.ok ? await res.json() : null;
      const ok = res.ok && Array.isArray(body);
      check(`site ${id}: connectivity`, ok, {
        detail: ok ? `${site.baseUrl} reachable, JSON array returned` : `HTTP ${res.status}`,
        fix: ok ? "" : "Is the site up and BLOG_API_KEY set on the server?",
      });
    }
  } catch (e) {
    check(`site ${id}: connectivity`, false, {
      detail: e.message,
      fix: "Is the site running and reachable from this machine?",
    });
  }
}

// -- SocialCue (optional; only /seoblog:socialcue needs it) --
if (config) {
  const cli = findSocialCueCli(config);
  const store = cli && !cli.error ? findSocialCueStore(config) : null;
  const brands = store?.storeDir ? readSocialCueBrands(store.storeDir) : [];
  const ok = !!(cli && !cli.error && store && !store.error);
  check("SocialCue (for /seoblog:socialcue)", ok, {
    required: workflow === "socialcue",
    detail: !cli || cli.error
      ? cli?.error ?? "SocialCue not found — library drafts unavailable"
      : !store || store.error
        ? `cli ${cli.version ?? "?"} found; no .socialdiscovery store from this cwd`
        : `cli ${cli.version ?? "?"}, store ${store.storeDir} (${brands.length} brand(s))`,
    fix: !cli || cli.error
      ? "Set socialCue.cliPath to an installed SocialCue lib/cli.js (Claude: /plugin install socialcue@productive-mark)"
      : !store || store.error
        ? "Run from your SocialCue project, or set socialCue.dir in ~/.config/seoblog/config.json"
        : "",
  });
}

// -- report --
const ok = checks.every((c) => c.ok || !c.required);
for (const c of checks) {
  const mark = c.ok ? "✓" : c.required ? "✗" : "–";
  console.error(`  ${mark} ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  if (!c.ok && c.fix) console.error(`      fix: ${c.fix}`);
}
console.error(ok ? "\nAll required checks passed." : "\nFix the ✗ checks above.");
console.log(JSON.stringify({ ok, checks }));
process.exit(ok ? 0 : 1);
