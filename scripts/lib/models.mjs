/**
 * The one authoritative registry of generation endpoints + prices, so the spend
 * estimate the user approves and the cost a script reports come from the same
 * numbers. Verify prices against fal.ai/models/<endpoint> when bumping.
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
};

/** Cost estimate for a run: hero + inline count + optional OG image. */
export function estimateCost({ heroCount = 1, inlineCount = 0, ogCount = 1 }) {
  const images = heroCount + inlineCount + ogCount;
  return { images, totalUsd: +(images * MODELS.image.pricePerImage).toFixed(2) };
}
