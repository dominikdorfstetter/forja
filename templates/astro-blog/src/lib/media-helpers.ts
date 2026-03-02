// ---------------------------------------------------------------------------
// Responsive image helpers — pure utility, no Astro dependency
// ---------------------------------------------------------------------------

import type { MediaResponse, MediaVariantResponse } from "./api";

export interface ResponsiveImageData {
  src: string;
  srcset: string;
  sizes: string;
  width: number;
  height: number;
  webpSrcset?: string;
  avifSrcset?: string;
}

function variantSrcsetEntry(v: MediaVariantResponse): string | null {
  if (!v.public_url) return null;
  return `${v.public_url} ${v.width}w`;
}

function isWebP(v: MediaVariantResponse): boolean {
  return v.variant_name.toLowerCase().includes("webp");
}

function isAvif(v: MediaVariantResponse): boolean {
  return v.variant_name.toLowerCase().includes("avif");
}

/**
 * Build responsive image data from a MediaResponse.
 * Groups variants into standard, WebP, and Avif srcsets.
 */
export function buildResponsiveImage(
  media: MediaResponse,
  sizesHint = "(max-width: 768px) 100vw, 720px",
): ResponsiveImageData {
  const standard: string[] = [];
  const webp: string[] = [];
  const avif: string[] = [];

  for (const v of media.variants) {
    const entry = variantSrcsetEntry(v);
    if (!entry) continue;
    if (isAvif(v)) {
      avif.push(entry);
    } else if (isWebP(v)) {
      webp.push(entry);
    } else {
      standard.push(entry);
    }
  }

  return {
    src: media.public_url ?? "",
    srcset: standard.join(", "),
    sizes: sizesHint,
    width: media.width ?? 800,
    height: media.height ?? 450,
    webpSrcset: webp.length > 0 ? webp.join(", ") : undefined,
    avifSrcset: avif.length > 0 ? avif.join(", ") : undefined,
  };
}
