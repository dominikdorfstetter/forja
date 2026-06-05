import type { APIRoute } from "astro";

/**
 * Proxy the RSS feed from the Forja API.
 * Can't use client.blogs.rss() because the SDK's HTTP client
 * parses all responses as JSON, but RSS is XML.
 */
export const GET: APIRoute = async () => {
  const baseUrl = (import.meta.env.CMS_API_URL as string).replace(/\/+$/, '');
  const apiKey = import.meta.env.CMS_API_KEY as string;
  const siteId = import.meta.env.CMS_SITE_ID as string;

  try {
    const res = await fetch(`${baseUrl}/sites/${siteId}/feed.rss`, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!res.ok) {
      console.error(`[CMS] RSS feed returned ${res.status}`);
      return new Response("RSS feed not available", { status: 502 });
    }

    const xml = await res.text();
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[CMS] Failed to fetch RSS feed:", e instanceof Error ? e.message : e);
    return new Response("RSS feed not available", { status: 502 });
  }
};
