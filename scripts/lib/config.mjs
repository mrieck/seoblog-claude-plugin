/**
 * Site config + per-site state, both living OUTSIDE the plugin directory
 * (plugin cache dirs are version-pinned and wiped on update):
 *
 *   ~/.config/seoblog/config.json          non-secret site config
 *   ~/.config/seoblog/state/<siteId>.json  article history + keyword queue
 *
 * Config shape:
 *   { "defaultSite": "plugmyplugin",
 *     "sites": { "<id>": { "baseUrl", "cmsType", "author", "niche", "toneGuide",
 *                          "voiceSamples", "directions", "articleLength", "product",
 *                          "shopifyBlogId", "imageReviewRounds" } } }
 *
 *   imageReviewRounds (optional, integer 0–3, default 2): paid fix rounds the
 *   blog-images skill may spend per image after vision review. 0 = review and
 *   report only. Applied by the skill; scripts pass it through untouched.
 *
 *   voiceSamples (optional, string[]): 1–3 paragraphs of the author's own
 *   writing, each either inline text or an absolute path to a text file. The
 *   humanize skill matches their rhythm, word choice and punctuation (dashes
 *   included). Applied by the skill; doctor only validates the shape.
 *
 *   Optional top-level "socialCue" (for /seoblog:socialcue — see socialcue.mjs):
 *   { "dir": "/abs/path/.socialdiscovery",   // the SocialCue store to write to
 *     "cliPath": null,                        // override for SocialCue's lib/cli.js
 *     "brandBySite": { "<siteId>": "<brand name>" } }   // site → brand hints
 *
 * State shape (replaces the Apify actor's KV blog_poster_state):
 *   { "articleHistory": [{ "id", "slug", "title", "keywords", "status",
 *                          "wordCount", "createdAt" }],
 *     "keywordQueue":   [{ "keyword", "status": "pending|in-progress|completed",
 *                          "articleId" }],
 *     "lastRunAt": "<iso>",
 *     "socialPosts":    [{ "contentItemId", "title", "brandName", "platform",
 *                          "hostSite", "assetHolderId", "createdAt" }] }
 *
 * Unlike secrets, non-secret config IS written from scripts — there is nothing
 * sensitive about a base URL or a tone guide.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { configPath } from "./env.mjs";

export function readConfig() {
  const file = configPath();
  if (!existsSync(file)) return { defaultSite: null, sites: {}, socialCue: null };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return {
      defaultSite: parsed.defaultSite ?? null,
      sites: parsed.sites && typeof parsed.sites === "object" ? parsed.sites : {},
      socialCue: parsed.socialCue && typeof parsed.socialCue === "object" ? parsed.socialCue : null,
    };
  } catch (e) {
    throw new Error(`Malformed config at ${file}: ${e.message}`);
  }
}

export function writeConfig(config) {
  const file = configPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  return file;
}

/** Resolve a site entry by id, falling back to defaultSite / the only site. */
export function getSite(siteId = null) {
  const config = readConfig();
  const ids = Object.keys(config.sites);
  const id = siteId ?? config.defaultSite ?? (ids.length === 1 ? ids[0] : null);
  if (!id || !config.sites[id]) {
    const known = ids.length ? `Known sites: ${ids.join(", ")}` : "No sites configured — run /seoblog:setup.";
    throw new Error(`Site "${siteId ?? "(default)"}" not found. ${known}`);
  }
  return { id, site: config.sites[id] };
}

export function statePath(siteId) {
  return path.join(path.dirname(configPath()), "state", `${siteId}.json`);
}

const EMPTY_STATE = { articleHistory: [], keywordQueue: [], lastRunAt: null, socialPosts: [] };

export function readState(siteId) {
  const file = statePath(siteId);
  if (!existsSync(file)) return structuredClone(EMPTY_STATE);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return {
      articleHistory: Array.isArray(parsed.articleHistory) ? parsed.articleHistory : [],
      keywordQueue: Array.isArray(parsed.keywordQueue) ? parsed.keywordQueue : [],
      lastRunAt: parsed.lastRunAt ?? null,
      // SocialCue posts written by /seoblog:socialcue (dedup + audit trail).
      socialPosts: Array.isArray(parsed.socialPosts) ? parsed.socialPosts : [],
    };
  } catch {
    // Corrupt state should not block a run; dedup degrades to the live CMS list.
    return structuredClone(EMPTY_STATE);
  }
}

export function writeState(siteId, state) {
  const file = statePath(siteId);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
  return file;
}
