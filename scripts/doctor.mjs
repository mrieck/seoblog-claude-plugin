/**
 * Environment preflight. Run before any writing session:
 *
 *   node scripts/doctor.mjs [--site <id>]
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
import { parseArgs } from "./lib/args.mjs";
import { loadSecrets, secretSource, siteApiKey, configPath } from "./lib/env.mjs";
import { readConfig } from "./lib/config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.join(HERE, "..");

const checks = [];
function check(name, ok, { required = true, detail = "", fix = "" } = {}) {
  checks.push({ name, ok: !!ok, required, detail, fix });
}

const args = parseArgs(process.argv.slice(2));

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
  detail: depsOk ? "" : "node_modules missing @fal-ai/client and/or sharp",
  fix: `cd "${PLUGIN_ROOT}" && npm install`,
});

// -- secrets --
loadSecrets();
const falSource = secretSource("FAL_API_KEY");
check("FAL_API_KEY", !!process.env.FAL_API_KEY, {
  required: false, // articles can ship without images
  detail: falSource ? `from ${falSource}` : "not set — image generation disabled",
  fix: "security add-generic-password -s seoblog -a FAL_API_KEY -w",
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
    fix: n ? "" : "Run /seoblog:setup",
  });
} catch (e) {
  check("config file", false, { detail: e.message, fix: `Fix or delete ${configPath()}` });
}

const siteIds = config
  ? args.site
    ? [args.site]
    : Object.keys(config.sites)
  : [];
for (const id of siteIds) {
  const site = config.sites[id];
  if (!site) {
    check(`site ${id}`, false, { detail: "not in config", fix: "Run /seoblog:setup" });
    continue;
  }
  if (!site.baseUrl) {
    check(`site ${id}: baseUrl`, false, { detail: "no baseUrl", fix: "Run /seoblog:setup" });
    continue;
  }
  const { key, source } = siteApiKey(id, site);
  check(`site ${id}: API key`, !!key, {
    detail: key ? `from ${source}` : "not found",
    fix: `security add-generic-password -s seoblog -a "site:${id}" -w`,
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
