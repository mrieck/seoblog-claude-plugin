/**
 * fal.ai client helpers, ported from the demoday plugin (which ported them from
 * the ai-video-maker actor).
 *
 * `submitAndWait` BLOCKS until the job is done and returns the result data —
 * no submit/sleep/poll loop, because these run as plain local CLI processes.
 * (The Apify actor needed the async queue + check_image_status dance because
 * its MCP tools had per-call timeouts; a CLI does not.)
 */
import { fal } from "@fal-ai/client";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadSecrets } from "./env.mjs";

loadSecrets();

let initialized = false;

/** Configure the fal client from FAL_API_KEY, or hard-fail with a clear message. */
export function initFal() {
  if (initialized) return fal;
  const key = process.env.FAL_API_KEY;
  if (!key) {
    console.error(
      "Error: FAL_API_KEY is not set.\n" +
        "  Recommended: security add-generic-password -s seoblog -a FAL_API_KEY -w\n" +
        "  Get a key at https://fal.ai/dashboard/keys"
    );
    process.exit(1);
  }
  fal.config({ credentials: key });
  initialized = true;
  return fal;
}

/**
 * Submit a job and wait for the result. Returns the `data` object.
 * Logs fal queue progress to stderr so long jobs show life.
 */
export async function submitAndWait(endpoint, input) {
  const client = initFal();
  const result = await client.subscribe(endpoint, {
    input,
    logs: false,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS" || update.status === "IN_QUEUE") {
        process.stderr.write(`  [fal] ${endpoint}: ${update.status}\r`);
      }
    },
  });
  process.stderr.write("\n");
  return result.data;
}

/** Pull the first usable image URL out of a fal result, matching the actor's logic. */
export function extractUrl(data) {
  return data?.images?.[0]?.url || data?.image?.url || null;
}

/**
 * Download a URL to a local path, creating parent dirs. Returns the absolute path.
 *
 * Retries on transient failures. The generation itself has already been paid for
 * by the time we get here, so losing the result to a momentary network blip is
 * the most expensive possible way to fail — and `fetch` rejecting with a bare
 * "fetch failed" is common enough against media CDNs to be worth handling.
 */
export async function download(url, outPath, { retries = 3 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // 4xx means the URL is wrong or expired; retrying will not help.
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Download failed ${res.status} for ${url}`);
        }
        throw new Error(`Download failed ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const abs = path.resolve(outPath);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, buf);
      return abs;
    } catch (e) {
      lastError = e;
      if (/failed 4\d\d/.test(e.message) || attempt === retries) break;
      const backoffMs = 800 * attempt;
      process.stderr.write(`  [fal] download attempt ${attempt} failed, retrying in ${backoffMs}ms\n`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error(`Download failed after ${retries} attempts for ${url}: ${lastError?.message}`);
}
