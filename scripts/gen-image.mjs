/**
 * Generate one blog image via fal.ai and save it locally.
 *
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/hero.jpg
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/og.jpg --purpose og
 *   node scripts/gen-image.mjs --prompt "..." --out /tmp/inline.jpg --aspect 4:3
 *
 * --purpose og generates at 16:9 and center-crops to exactly 1200×630 (the
 * social-card ratio; nano-banana-pro has no 1.91:1 aspect option). Other
 * purposes save the fal JPEG as-is.
 *
 * stdout: {ok, path, width, height, costUsd, purpose}   stderr: progress.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, requireArg } from "./lib/args.mjs";
import { submitAndWait, extractUrl, download } from "./lib/fal.mjs";
import { MODELS } from "./lib/models.mjs";
import { main, info, report } from "./lib/log.mjs";

const USAGE =
  'gen-image.mjs --prompt "..." --out <file.jpg> [--aspect 1:1|16:9|9:16|4:3|3:4] [--purpose hero|inline|og]';

await main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const prompt = requireArg(args, "prompt", USAGE);
  const out = requireArg(args, "out", USAGE);
  const purpose = ["hero", "inline", "og"].includes(args.purpose) ? args.purpose : "inline";

  const model = MODELS.image;
  let aspect = args.aspect ?? model.defaultAspect;
  if (purpose === "og") aspect = "16:9"; // cropped to 1200×630 below
  if (!model.aspectRatios.includes(aspect)) {
    throw new Error(`--aspect must be one of ${model.aspectRatios.join(", ")}`);
  }

  info(`Generating ${purpose} image (${aspect}) via ${model.endpoint}…`);
  const data = await submitAndWait(model.endpoint, {
    ...model.input,
    prompt,
    aspect_ratio: aspect,
  });
  const url = extractUrl(data);
  if (!url) throw new Error("fal returned no image URL");

  const abs = await download(url, out);

  if (purpose === "og") {
    const cropped = await sharp(await readFile(abs))
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .jpeg({ quality: 88 })
      .toBuffer();
    await writeFile(abs, cropped);
  }

  const meta = await sharp(abs).metadata();
  report(`Saved ${path.basename(abs)} (${meta.width}×${meta.height})`, {
    ok: true,
    path: abs,
    width: meta.width,
    height: meta.height,
    costUsd: model.pricePerImage,
    purpose,
  });
});
