/**
 * Conventions for the "asset-holder" draft that hosts images for a SocialCue
 * post. Indie Hackers / dev.to bodies embed images by public URL, and the only
 * image host this plugin has is the blog CMS — whose upload endpoint hangs off
 * an article id. So socialcue.mjs host-images creates ONE draft article per
 * post on the chosen site, uploads the images to it, and uses the returned
 * absolute imageUrls in the markdown. The holder is never published; every
 * blog flow (list, publish, topic dedup) recognises and skips it by slug
 * prefix or tag.
 */
export const ASSET_SLUG_PREFIX = "sc-assets-";
export const ASSET_TAG = "socialcue-assets";

export function isAssetHolder(article = {}) {
  const slug = String(article.slug ?? "");
  const tags = Array.isArray(article.tags) ? article.tags : [];
  return slug.startsWith(ASSET_SLUG_PREFIX) || tags.includes(ASSET_TAG);
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
}

/** The create payload for a holder. `create` is draft-only in every adapter. */
export function assetHolderArticle(title, { slug, author } = {}) {
  const base = slugify(slug || title) || "post";
  return {
    title: `[socialcue assets] ${title}`,
    slug: `${ASSET_SLUG_PREFIX}${base}`,
    body:
      "<p>Image host for a SocialCue post written by the seoblog plugin. " +
      "This draft exists only so its images have public URLs — do not publish it.</p>",
    excerpt: "Image host for a SocialCue post — do not publish.",
    metaDescription: "Image host for a SocialCue post — do not publish.",
    tags: [ASSET_TAG],
    status: "draft",
    ...(author && { author }),
  };
}
