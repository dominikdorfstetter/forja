// ---------------------------------------------------------------------------
// SEO metadata helpers — pure utility, no Astro dependency
// ---------------------------------------------------------------------------

export interface SeoInput {
  title: string;
  description: string;
  canonicalUrl: string;
  siteUrl: string;
  siteName: string;
  ogType?: "website" | "article";
  ogImage?: string;
  ogImageAlt?: string;
  article?: {
    publishedTime: string;
    author: string;
    tags?: string[];
  };
}

export interface SeoMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  og: {
    type: string;
    title: string;
    description: string;
    url: string;
    siteName: string;
    image?: string;
    imageAlt?: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  article?: {
    publishedTime: string;
    author: string;
    tags: string[];
  };
  jsonLd: Record<string, unknown>;
}

export function buildSeoMeta(input: SeoInput): SeoMeta {
  const ogType = input.ogType ?? "website";

  const jsonLd: Record<string, unknown> =
    ogType === "article" && input.article
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: input.title,
          description: input.description,
          url: input.canonicalUrl,
          datePublished: input.article.publishedTime,
          author: {
            "@type": "Person",
            name: input.article.author,
          },
          publisher: {
            "@type": "Organization",
            name: input.siteName,
          },
          ...(input.ogImage ? { image: input.ogImage } : {}),
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: input.siteName,
          url: input.siteUrl,
          description: input.description,
        };

  return {
    title: input.title,
    description: input.description,
    canonicalUrl: input.canonicalUrl,
    og: {
      type: ogType,
      title: input.title,
      description: input.description,
      url: input.canonicalUrl,
      siteName: input.siteName,
      image: input.ogImage,
      imageAlt: input.ogImageAlt,
    },
    twitter: {
      card: input.ogImage ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      image: input.ogImage,
    },
    article: input.article
      ? {
          publishedTime: input.article.publishedTime,
          author: input.article.author,
          tags: input.article.tags ?? [],
        }
      : undefined,
    jsonLd,
  };
}
