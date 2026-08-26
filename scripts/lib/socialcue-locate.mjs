/**
 * Find the user's SocialCue plugin and its store, from OUTSIDE that plugin.
 *
 * ${CLAUDE_PLUGIN_ROOT} only ever points at seoblog's own install dir, so the
 * SocialCue CLI has to be discovered:
 *
 *   cli:    config.socialCue.cliPath → $SOCIALCUE_CLI
 *           → newest ~/.claude/plugins/cache/<marketplace>/socialcue/<ver>/lib/cli.js
 *   store:  config.socialCue.dir → $SOCIALCUE_DIR
 *           → nearest ancestor of cwd with .socialdiscovery/config.json
 *
 * The store is per-project (SocialCue walks up from cwd and otherwise CREATES
 * ./.socialdiscovery), so we only accept a dir whose config.json already exists —
 * never let a scheduled run invent an empty store somewhere.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const CACHE_ROOT = path.join(os.homedir(), ".claude", "plugins", "cache");

function semverParts(v) {
  return String(v).split(".").map((n) => parseInt(n, 10) || 0);
}
function newerSemver(a, b) {
  const pa = semverParts(a), pb = semverParts(b);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

function cliCandidatesFromCache() {
  const found = [];
  if (!existsSync(CACHE_ROOT)) return found;
  for (const marketplace of readdirSync(CACHE_ROOT, { withFileTypes: true })) {
    if (!marketplace.isDirectory()) continue;
    const pluginDir = path.join(CACHE_ROOT, marketplace.name, "socialcue");
    if (!existsSync(pluginDir)) continue;
    for (const ver of readdirSync(pluginDir, { withFileTypes: true })) {
      if (!ver.isDirectory()) continue;
      const cli = path.join(pluginDir, ver.name, "lib", "cli.js");
      if (existsSync(cli)) found.push({ cliPath: cli, version: ver.name, marketplace: marketplace.name });
    }
  }
  return found;
}

function readVersion(cliPath) {
  try {
    const root = path.join(path.dirname(cliPath), "..");
    const pj = JSON.parse(readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"));
    return pj.version ?? null;
  } catch {
    return null;
  }
}

/**
 * SocialCue's store is SQLite via better-sqlite3, a native module. A plugin
 * cache copy carries the node_modules it was built with, which may not match
 * the Node running here (ABI mismatch → "Could not locate the bindings file").
 * So a candidate only counts if its better-sqlite3 actually loads under this
 * Node. Returns null on success, else the first line of the load error.
 */
function probeCli(cliPath) {
  const root = path.join(path.dirname(cliPath), "..");
  const mod = path.join(root, "node_modules", "better-sqlite3");
  if (!existsSync(mod)) return "node_modules/better-sqlite3 missing (run npm install in the plugin dir)";
  try {
    // The native binding loads lazily — only opening a database exercises it.
    execFileSync(process.execPath, ["-e", "new (require(process.argv[1]))(':memory:').close()", mod], {
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 15_000,
      encoding: "utf8",
    });
    return null;
  } catch (e) {
    const line = String(e.stderr || e.message).split("\n").find((s) => /error|could not|cannot/i.test(s));
    return (line || "better-sqlite3 failed to load").trim();
  }
}

/** → { cliPath, version, source } | { error } | null (nothing installed) */
export function findSocialCueCli(config = {}) {
  const explicit = config.socialCue?.cliPath || process.env.SOCIALCUE_CLI;
  if (explicit) {
    const abs = path.resolve(explicit);
    const source = config.socialCue?.cliPath ? "config" : "env";
    if (!existsSync(abs)) return { error: `SocialCue CLI not found at ${abs} (${source})` };
    const problem = probeCli(abs);
    if (problem) return { error: `SocialCue CLI at ${abs} cannot run under node ${process.versions.node}: ${problem}` };
    return { cliPath: abs, version: readVersion(abs), source };
  }
  const candidates = cliCandidatesFromCache().sort((a, b) => (newerSemver(a.version, b.version) ? -1 : 1));
  if (!candidates.length) return null;
  const problems = [];
  for (const c of candidates) {
    const problem = probeCli(c.cliPath);
    if (!problem) return { ...c, source: `plugin cache (${c.marketplace})` };
    problems.push(`${c.version}: ${problem}`);
  }
  return {
    error:
      `SocialCue is installed but no copy runs under node ${process.versions.node} — ` +
      `${problems[0]}. Point "socialCue.cliPath" in ~/.config/seoblog/config.json at a checkout whose npm install matches this Node, ` +
      `or reinstall SocialCue (/plugin install socialcue@productive-mark) and run npm install in its cache dir.`,
  };
}

function walkUpForStore(start) {
  let dir = path.resolve(start);
  for (;;) {
    const candidate = path.join(dir, ".socialdiscovery");
    if (existsSync(path.join(candidate, "config.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** → { storeDir, source } or null. Only dirs with an existing config.json count. */
export function findSocialCueStore(config = {}, cwd = process.cwd()) {
  const tryDir = (d, source) => {
    if (!d) return null;
    const abs = path.resolve(d);
    return existsSync(path.join(abs, "config.json")) ? { storeDir: abs, source } : { error: `no config.json in ${abs}`, source };
  };
  const fromConfig = tryDir(config.socialCue?.dir, "config");
  if (fromConfig) return fromConfig;
  const fromEnv = tryDir(process.env.SOCIALCUE_DIR, "env");
  if (fromEnv) return fromEnv;
  const walked = walkUpForStore(cwd);
  return walked ? { storeDir: walked, source: "cwd" } : null;
}

/** Brands straight from the store's config.json (the source of truth; SQLite never holds them). */
export function readSocialCueBrands(storeDir) {
  try {
    const cfg = JSON.parse(readFileSync(path.join(storeDir, "config.json"), "utf8"));
    return (cfg.brands ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      url: b.url ?? "",
      tagline: b.tagline ?? "",
      isActive: b.isActive !== false,
    }));
  } catch {
    return [];
  }
}
