/**
 * CMS adapters shared by cms.mjs (blog publishing) and socialcue.mjs (image
 * hosting for SocialCue posts). One class per cmsType:
 *
 *   articles-api  the generic Articles API (X-API-Key; implemented by
 *                 plugmyplugin.com and the Cue Up WordPress plugin)
 *   wordpress     alias of articles-api (requires the Cue Up WP plugin, NOT the
 *                 vanilla WP REST API)
 *   shopify       native Shopify Admin API 2024-01 (Custom App token with
 *                 write_content; blog resolved from shopifyBlogId or first blog)
 *
 * Every adapter exposes list / create / update / get / uploadImage. create is
 * draft-only by design in both adapters — publishing is exclusively the
 * update flip. uploadImage returns { imageUrl, path }: imageUrl is always an
 * absolute fetchable URL; path is what belongs in the site's own body HTML
 * (root-relative on Postgres-backed articles-api sites, the same absolute URL
 * on object-storage-backed sites and Shopify).
 */
import path from "node:path";
import { siteApiKey } from "./env.mjs";
import { info } from "./log.mjs";

// ---- articles-api adapter (wordpress is the same wire contract) ----

export class ArticlesApi {
  constructor(baseUrl, apiKey, author) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.author = author;
  }

  headers(extra = {}) {
    return { "X-API-Key": this.apiKey, ...extra };
  }

  async check(res, what) {
    if (!res.ok) throw new Error(`${what} failed (${res.status}): ${await res.text()}`);
    return res;
  }

  async list({ limit, offset, status } = {}) {
    const url = new URL("/api/articles", this.baseUrl);
    if (limit) url.searchParams.set("limit", String(limit));
    if (offset) url.searchParams.set("offset", String(offset));
    // Key sent on GET too, so drafts/archived come back for dedup.
    const res = await this.check(await fetch(url, { headers: this.headers() }), "list");
    const articles = await res.json();
    return status ? articles.filter((a) => a.status === status) : articles;
  }

  async create(article) {
    const res = await this.check(
      await fetch(new URL("/api/articles", this.baseUrl), {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: article.title,
          body: article.body,
          excerpt: article.excerpt,
          author: article.author || this.author,
          // Create is draft-only by design; publishing is exclusively the PATCH flip.
          status: "draft",
          tags: article.tags || [],
          metaDescription: article.metaDescription,
          ...(article.slug && { slug: article.slug }),
        }),
      }),
      "create",
    );
    return res.json();
  }

  async update(id, patch) {
    const res = await this.check(
      await fetch(new URL(`/api/articles/${id}`, this.baseUrl), {
        method: "PATCH",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(patch),
      }),
      `update ${id}`,
    );
    return res.json().catch(() => ({ ok: true }));
  }

  async get(id) {
    const res = await this.check(
      await fetch(new URL(`/api/articles/${id}`, this.baseUrl), { headers: this.headers() }),
      `get ${id}`,
    );
    return res.json();
  }

  async uploadImage(id, buf, filename, { purpose = "inline", alt } = {}) {
    const url = new URL(`/api/articles/${id}/upload-image`, this.baseUrl);
    url.searchParams.set("purpose", purpose);
    if (alt) url.searchParams.set("alt_text", alt);

    const form = new FormData();
    form.append("image", new Blob([buf], { type: guessMime(filename) }), filename);

    // Astro's CSRF checkOrigin inspects multipart POSTs; server-to-server
    // clients send no Origin by default, so always send a matching one.
    const res = await this.check(
      await fetch(url, {
        method: "POST",
        headers: this.headers({ Origin: new URL(this.baseUrl).origin }),
        body: form,
      }),
      `upload-image ${id}`,
    );
    const body = await res.json();
    // Server-provided path wins (absolute CDN URL on object-storage sites);
    // deriving from imageUrl is the fallback for older articles-api servers.
    return { imageUrl: body.imageUrl, path: body.path ?? new URL(body.imageUrl).pathname };
  }
}

// ---- shopify adapter ----

const SHOPIFY_API_VERSION = "2024-01";

export class Shopify {
  constructor(storeUrl, accessToken, author, blogId) {
    this.storeUrl = storeUrl.replace(/\/$/, "");
    this.accessToken = accessToken;
    this.author = author;
    this.blogId = blogId || null;
  }

  headers() {
    return { "X-Shopify-Access-Token": this.accessToken, "Content-Type": "application/json" };
  }

  adminUrl(p) {
    return `${this.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/${p}`;
  }

  async check(res, what) {
    if (!res.ok) throw new Error(`${what} failed (${res.status}): ${await res.text()}`);
    return res;
  }

  async resolveBlogId() {
    if (this.blogId) return this.blogId;
    const res = await this.check(
      await fetch(this.adminUrl("blogs.json"), { headers: this.headers() }),
      "list blogs",
    );
    const { blogs } = await res.json();
    if (!blogs?.length) throw new Error("No blogs found on this Shopify store");
    this.blogId = String(blogs[0].id);
    return this.blogId;
  }

  async list({ limit, status } = {}) {
    const blogId = await this.resolveBlogId();
    const url = new URL(this.adminUrl("articles.json"));
    url.searchParams.set("blog_id", blogId);
    if (limit) url.searchParams.set("limit", String(limit));
    const res = await this.check(await fetch(url, { headers: this.headers() }), "list");
    const { articles } = await res.json();
    const mapped = articles.map((a) => ({
      id: String(a.id),
      title: a.title,
      slug: a.handle,
      status: a.published_at ? "published" : "draft",
      tags: a.tags ? a.tags.split(", ").filter(Boolean) : [],
      createdAt: a.created_at,
      excerpt: a.summary_html ?? undefined,
    }));
    return status ? mapped.filter((a) => a.status === status) : mapped;
  }

  articlePayload(a) {
    const payload = {};
    if (a.title !== undefined) payload.title = a.title;
    if (a.body !== undefined) payload.body_html = a.body;
    if (a.excerpt !== undefined) payload.summary_html = a.excerpt;
    if (a.status !== undefined) payload.published = a.status === "published";
    if (a.tags !== undefined) payload.tags = a.tags.join(", ");
    if (a.slug !== undefined) payload.handle = a.slug;
    if (a.metaDescription !== undefined) {
      payload.metafields = [
        {
          key: "description_tag",
          value: a.metaDescription,
          type: "single_line_text_field",
          namespace: "global",
        },
      ];
    }
    return payload;
  }

  async create(article) {
    const blogId = await this.resolveBlogId();
    const payload = {
      blog_id: blogId,
      author: article.author || this.author,
      // Create is draft-only by design; publishing is exclusively the update flip.
      published: false,
      ...this.articlePayload(article),
    };
    const res = await this.check(
      await fetch(this.adminUrl("articles.json"), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ article: payload }),
      }),
      "create",
    );
    const { article: created } = await res.json();
    return { id: String(created.id), slug: created.handle };
  }

  async update(id, patch) {
    await this.check(
      await fetch(this.adminUrl(`articles/${id}.json`), {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ article: this.articlePayload(patch) }),
      }),
      `update ${id}`,
    );
    return { ok: true };
  }

  async get() {
    throw new Error("get is only supported for articles-api sites");
  }

  async uploadImage(id, buf, filename, { purpose = "inline", alt } = {}) {
    if (purpose === "hero") {
      // Featured image: attach directly to the article.
      const imagePayload = { attachment: buf.toString("base64"), filename };
      if (alt) imagePayload.alt = alt;
      const res = await this.check(
        await fetch(this.adminUrl(`articles/${id}.json`), {
          method: "PUT",
          headers: this.headers(),
          body: JSON.stringify({ article: { image: imagePayload } }),
        }),
        `upload hero ${id}`,
      );
      const { article } = await res.json();
      if (!article.image?.src) throw new Error("Shopify returned no image URL after hero upload");
      return { imageUrl: article.image.src, path: article.image.src };
    }

    // inline (and og, which Shopify has no slot for — it lands in Files):
    // staged S3 upload → fileCreate → CDN URL.
    const mimeType = guessMime(filename);
    const gql = async (query, variables, what) => {
      const res = await this.check(
        await fetch(this.adminUrl("graphql.json"), {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ query, variables }),
        }),
        what,
      );
      return res.json();
    };

    const staged = await gql(
      STAGED_UPLOADS_MUTATION,
      {
        input: [
          {
            resource: "FILE",
            filename,
            mimeType,
            fileSize: String(buf.byteLength),
            httpMethod: "POST",
          },
        ],
      },
      "stagedUploadsCreate",
    );
    const target = staged.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) throw new Error("No staged upload target returned by Shopify");

    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([buf], { type: mimeType }), filename);
    const s3Res = await fetch(target.url, { method: "POST", body: form });
    if (!s3Res.ok) throw new Error(`S3 upload for inline image failed (${s3Res.status})`);

    const fileData = await gql(
      FILE_CREATE_MUTATION,
      { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }] },
      "fileCreate",
    );
    const file = fileData.data?.fileCreate?.files?.[0];
    if (!file?.image?.url) throw new Error("Shopify returned no CDN URL after inline image upload");
    return { imageUrl: file.image.url, path: file.image.url };
  }
}

const STAGED_UPLOADS_MUTATION = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
            stagedTargets {
                url
                resourceUrl
                parameters { name value }
            }
            userErrors { field message }
        }
    }
`;

const FILE_CREATE_MUTATION = `
    mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
            files {
                ... on MediaImage {
                    image { url }
                }
            }
            userErrors { field message }
        }
    }
`;

export function guessMime(p) {
  const ext = path.extname(p).toLowerCase();
  return (
    { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[
      ext
    ] || "image/jpeg"
  );
}

// ---- dispatch ----

export function makeAdapter(siteId, site) {
  if (!site.baseUrl) throw new Error(`Site "${siteId}" has no baseUrl configured`);
  const { key, source } = siteApiKey(siteId, site);
  if (!key) {
    throw new Error(
      `No API key for site "${siteId}". Store one with:\n` +
        `  security add-generic-password -s seoblog -a "site:${siteId}" -w`,
    );
  }
  info(`  site ${siteId} (${site.cmsType || "articles-api"}), key from ${source}`);
  if (site.cmsType === "shopify") {
    return new Shopify(site.baseUrl, key, site.author, site.shopifyBlogId);
  }
  // articles-api and wordpress share the same wire contract.
  return new ArticlesApi(site.baseUrl, key, site.author);
}
