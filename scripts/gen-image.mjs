/**
 * Generate one blog image via fal.ai and save it locally — or edit an existing
 * round of it (the vision-review fix loop in the blog-images skill).
 *
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/hero.r0.jpg
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/og.r0.jpg --purpose og
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/inline.r0.jpg --aspect 4:3
 *   node scripts/gen-image.mjs --edit /tmp/hero.r0.jpg \
 *        --prompt "remove the loose cable on the left wall; keep everything else identical" \
 *        --out /tmp/hero.r1.jpg
 *
 * Modes
 *   generate (default)  text → image via fal-ai/nano-banana-pro.
 *   --edit <source.jpg> image + instruction → image via fal-ai/nano-banana-pro/edit.
 *        The source is uploaded to fal storage; --prompt is the edit instruction.
 *        --out must be a NEW file (rounds are never overwritten so the reviewer
 *        can compare them and fall back).
 *   --ref <file>        (repeatable) extra reference images — a real logo, a
 *        product shot, a style sample — sent to the edit endpoint alongside the
 *        source, so the prompt can say "the logo in the second image". Works with
 *        --edit (source is image 1, refs follow) and without it (pure
 *        reference-guided generation, still via the edit endpoint). PNG/JPEG/WebP
 *        as-is; SVG is rasterized to PNG first (fal wants a raster).
 *
 * --purpose og generates at 16:9 and center-crops to exactly 1200×630 (the
 * social-card ratio; nano-banana-pro has no 1.91:1 aspect option). The uncropped
 * 16:9 master is kept next to --out as <out-stem>.src.jpg and reported as
 * `editSource` — always edit the master, never the 1200×630 crop (unsupported
 * ratio; the edit model would re-frame it). Other purposes save the fal JPEG
 * as-is and `editSource` is the output itself.
 *
 * stdout: {ok, mode, path, editSource, width, height, costUsd, purpose}   stderr: progress.
 */
import sharp from "sharp";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { submitAndWait, extractUrl, download, uploadFile } from "./lib/fal.mjs";
import { MODELS } from "./lib/models.mjs";
import { main, info, report } from "./lib/log.mjs";

const USAGE =
  'gen-image.mjs --prompt "..." --out <file.jpg> [--aspect 1:1|16:9|9:16|4:3|3:4] [--purpose hero|inline|og] [--edit <source.jpg>] [--ref <image> …]';

const RASTER_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/**
 * Upload a reference image to fal storage. SVGs are rasterized to a 1024px PNG
 * first; anything else must already be a raster the model accepts.
 */
async function uploadRef(file) {
  const abs = path.resolve(file);
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".svg") {
    const png = path.join(tmpdir(), `${path.basename(abs, ext)}.ref.png`);
    await sharp(abs, { density: 300 }).resize(1024, 1024, { fit: "inside" }).png().toFile(png);
    return uploadFile(png, { contentType: "image/png" });
  }
  const contentType = RASTER_TYPES[ext];
  if (!contentType) throw new Error(`--ref ${file}: unsupported type ${ext || "(none)"}; use png/jpg/webp/svg`);
  return uploadFile(abs, { contentType });
}

/** `/a/b/x-og.r0.jpg` → `/a/b/x-og.r0.src.jpg` (the uncropped master for og images). */
function masterPathFor(outPath) {
  const ext = path.extname(outPath);
  return outPath.slice(0, outPath.length - ext.length) + ".src" + ext;
}

/** Nearest supported aspect ratio to a width×height, so edits keep a stable frame. */
function nearestAspect(width, height, ratios) {
  const target = width / height;
  let best = ratios[0];
  let bestDiff = Infinity;
  for (const r of ratios) {
    const [w, h] = r.split(":").map(Number);
    const diff = Math.abs(w / h - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}

await main(async () => {
  const args = parseArgs(process.argv.slice(2), { multi: ["ref"] });
  const prompt = requireArg(args, "prompt", USAGE);
  const out = path.resolve(requireArg(args, "out", USAGE));
  const purpose = ["hero", "inline", "og"].includes(args.purpose) ? args.purpose : "inline";
  const editSrc =
    args.edit && args.edit !== true ? path.resolve(String(args.edit)) : null;
  const refs = (args.ref ?? []).filter((r) => r !== true).map(String);
  // References ride on the edit endpoint; a generate-with-refs is still an "edit" call to fal.
  const mode = editSrc || refs.length ? "edit" : "generate";

  if (editSrc && (out === editSrc || out === masterPathFor(editSrc) || masterPathFor(out) === editSrc)) {
    throw new Error("--out would overwrite the --edit source round; write each round to a new file");
  }

  const model = mode === "edit" ? MODELS.imageEdit : MODELS.image;
  const ratios = MODELS.image.aspectRatios;

  let aspect = args.aspect ?? null;
  if (purpose === "og") {
    aspect = "16:9"; // cropped to 1200×630 below
  } else if (!aspect && editSrc) {
    const srcMeta = await sharp(editSrc).metadata();
    aspect = nearestAspect(srcMeta.width, srcMeta.height, ratios);
  } else if (!aspect) {
    aspect = MODELS.image.defaultAspect;
  }
  if (!ratios.includes(aspect)) {
    throw new Error(`--aspect must be one of ${ratios.join(", ")}`);
  }

  const input = { ...model.input, prompt, aspect_ratio: aspect };
  if (mode === "edit") {
    const from = editSrc ? `from ${path.basename(editSrc)}` : "from references";
    const withRefs = refs.length ? ` + ${refs.length} ref${refs.length > 1 ? "s" : ""}` : "";
    info(`Editing ${purpose} image (${aspect}) ${from}${withRefs} via ${model.endpoint}…`);
    input.image_urls = [];
    if (editSrc) input.image_urls.push(await uploadFile(editSrc));
    for (const r of refs) input.image_urls.push(await uploadRef(r));
  } else {
    info(`Generating ${purpose} image (${aspect}) via ${model.endpoint}…`);
  }

  const data = await submitAndWait(model.endpoint, input);
  const url = extractUrl(data);
  if (!url) throw new Error("fal returned no image URL");

  const abs = await download(url, out);
  let editSource = abs;

  if (purpose === "og") {
    // Keep the uncropped 16:9 master for future edit rounds, then crop the shipped file.
    const master = masterPathFor(abs);
    await copyFile(abs, master);
    editSource = master;
    const cropped = await sharp(await readFile(abs))
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .jpeg({ quality: 88 })
      .toBuffer();
    await writeFile(abs, cropped);
  }

  const meta = await sharp(abs).metadata();
  report(`Saved ${path.basename(abs)} (${meta.width}×${meta.height}, ${mode})`, {
    ok: true,
    mode,
    path: abs,
    editSource,
    width: meta.width,
    height: meta.height,
    costUsd: model.pricePerImage,
    purpose,
  });
});
