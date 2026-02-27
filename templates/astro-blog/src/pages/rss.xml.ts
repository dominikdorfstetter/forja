import type { APIRoute } from "astro";

const API_URL = import.meta.env.CMS_API_URL as string;
const API_KEY = import.meta.env.CMS_API_KEY as string;
const SITE_ID = import.meta.env.CMS_SITE_ID as string;

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${API_URL}/sites/${SITE_ID}/feed.rss`, {
      headers: { "X-API-Key": API_KEY },
    });
    if (!res.ok) {
      return new Response("RSS feed not available", { status: res.status });
    }
    const xml = await res.text();
    return new Response(xml, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  } catch (e) {
    console.error("[CMS] Failed to fetch RSS feed:", e instanceof Error ? e.message : e);
    return new Response("RSS feed not available", { status: 502 });
  }
};
