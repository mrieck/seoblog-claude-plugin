/**
 * The one authoritative registry of generation endpoints + prices, so the spend
 * estimate logged in the run report and the cost a script reports come from the
 * same numbers. Verify prices against fal.ai/models/<endpoint> when bumping.
 */
export const MODELS = {
  image: {
    endpoint: "fal-ai/nano-banana-pro",
    // $0.15/image at standard resolution (fal.ai pricing, verified 2026-08).
    pricePerImage: 0.15,
    // Fixed input params; prompt + aspect_ratio are supplied per call.
    input: { num_images: 1, output_format: "jpeg" },
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspect: "16:9",
  },
  // Image-to-image sibling used by the vision-review fix rounds: takes the
  // previous round as `image_urls` plus an edit instruction as `prompt`.
  imageEdit: {
    endpoint: "fal-ai/nano-banana-pro/edit",
    // $0.15/image at 1K/2K (verified 2026-08). 4K is billed 2× — never request it.
    pricePerImage: 0.15,
    input: { num_images: 1, output_format: "jpeg" },
  },
};

/** Default number of paid fix rounds per image when a site sets no `imageReviewRounds`. */
export const DEFAULT_REVIEW_ROUNDS = 2;
/** Hard clamp on `imageReviewRounds` (protects against config typos / runaway spend). */
export const MAX_REVIEW_ROUNDS = 3;

/**
 * Cost estimate for a run: hero + inline count + optional OG image.
 * `baseUsd` assumes every image passes review first time; `maxUsd` is the
 * worst case where every image uses all `reviewRounds` fix rounds.
 */
export function estimateCost({
  heroCount = 1,
  inlineCount = 0,
  ogCount = 1,
  reviewRounds = DEFAULT_REVIEW_ROUNDS,
}) {
  const images = heroCount + inlineCount + ogCount;
  const rounds = Math.max(0, Math.min(MAX_REVIEW_ROUNDS, reviewRounds));
  const baseUsd = +(images * MODELS.image.pricePerImage).toFixed(2);
  const maxUsd = +(baseUsd + images * rounds * MODELS.imageEdit.pricePerImage).toFixed(2);
  return { images, baseUsd, maxUsd, totalUsd: baseUsd };
}
