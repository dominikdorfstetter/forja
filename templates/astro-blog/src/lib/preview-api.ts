// ---------------------------------------------------------------------------
// Preview API Client — dynamic site_id + preview token authentication.
// Used by /preview/* routes to fetch content for any site without static config.
// ---------------------------------------------------------------------------

import type { SiteInfo, BlogDetailResponse, MediaResponse, SocialLinkResponse } from "./api";
import { ForjaApiError, type ProblemDetails } from "./api";

const API_URL = (import.meta.env.CMS_API_URL as string) || process.env.CMS_API_URL || '';

interface PreviewContext {
  siteId: string;
  token: string;
}

/** Fetch wrapper that authenticates with a preview token instead of API key. */
async function previewApi<T>(path: string, ctx: PreviewContext): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    headers: { "X-Preview-Token": ctx.token },
  });

  if (res.ok) return res.json() as Promise<T>;

  let problem: ProblemDetails;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = {
      type: "about:blank",
      title: res.statusText,
      status: res.status,
      detail: `${res.status} ${res.statusText} — ${url}`,
      code: "UNKNOWN_ERROR",
    };
  }
  throw new ForjaApiError(problem);
}

/** Fetch site info for the preview context's site. */
export async function fetchPreviewSite(ctx: PreviewContext): Promise<SiteInfo> {
  return previewApi(`/sites/${ctx.siteId}`, ctx);
}

/** Fetch a blog by slug within the preview context's site. */
export async function fetchPreviewBlogBySlug(
  slug: string,
  ctx: PreviewContext,
): Promise<BlogDetailResponse> {
  const brief = await previewApi<{ id: string }>(
    `/sites/${ctx.siteId}/blogs/by-slug/${slug}`,
    ctx,
  );
  return previewApi(`/blogs/${brief.id}/detail`, ctx);
}

/**
 * Make a relative URL absolute by prepending the backend origin.
 * Needed because the preview service runs on a different domain than
 * the backend that serves `/files/*`.
 */
function absoluteUrl(url: string | null): string | null {
  if (!url || url.startsWith('http')) return url;
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Fetch a media item by ID, resolving relative URLs to the backend origin. */
export async function fetchPreviewMedia(
  id: string,
  ctx: PreviewContext,
): Promise<MediaResponse> {
  const media = await previewApi<MediaResponse>(`/media/${id}`, ctx);
  media.public_url = absoluteUrl(media.public_url);
  if (media.variants) {
    media.variants = media.variants.map((v) => ({
      ...v,
      public_url: absoluteUrl(v.public_url),
    }));
  }
  return media;
}

/** Fetch social links for the preview context's site. */
export async function fetchPreviewSocialLinks(ctx: PreviewContext): Promise<SocialLinkResponse[]> {
  return previewApi(`/sites/${ctx.siteId}/social`, ctx);
}

/**
 * Fetch the public site settings (SEO defaults, manifest colors, contact
 * email) via the Viewer-accessible `/settings/public` endpoint — the raw
 * `/settings` endpoint is Admin-only and 403s for preview tokens.
 * Favicon data comes from `fetchPreviewFavicon`; there is no default OG
 * image URL in any Viewer-accessible payload, so consumers must degrade
 * to per-content images.
 */
export async function fetchPreviewSiteSettings(ctx: PreviewContext): Promise<{
  contact_email: string;
  theme_color: string;
  background_color: string;
  seo_title_template: string;
  seo_default_description: string;
}> {
  return previewApi(`/sites/${ctx.siteId}/settings/public`, ctx);
}

/** Fetch favicon info for the preview context's site. */
export async function fetchPreviewFavicon(ctx: PreviewContext): Promise<{
  favicon_url: string | null;
  apple_touch_icon_url: string | null;
  variants: { size: string; url: string }[];
} | null> {
  try {
    return await previewApi(`/sites/${ctx.siteId}/favicon`, ctx);
  } catch {
    return null;
  }
}
