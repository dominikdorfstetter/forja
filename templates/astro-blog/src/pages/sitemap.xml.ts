import type { APIRoute } from "astro";
import { fetchAllPublishedBlogs, fetchPages, getSiteUrl } from "../lib/api";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async () => {
  const siteUrl = getSiteUrl();
  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = [];

  // Static routes
  urls.push(
    { loc: `${siteUrl}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${siteUrl}/blog/`, changefreq: "daily", priority: "0.9" },
    { loc: `${siteUrl}/cv/`, changefreq: "monthly", priority: "0.7" },
  );

  // Blog posts
  try {
    const blogs = await fetchAllPublishedBlogs();

    for (const blog of blogs) {
      const slug = blog.slug ?? blog.id;
      urls.push({
        loc: `${siteUrl}/blog/${slug}/`,
        lastmod: blog.updated_at.split("T")[0],
        changefreq: "weekly",
        priority: "0.8",
      });
    }

    // We don't have category slugs from BlogListItem, but we can include
    // category archives if we fetch blog details — for now, skip to keep sitemap fast.
  } catch {
    // Continue with partial sitemap
  }

  // CMS pages
  try {
    const pagesResult = await fetchPages(1, 100);
    for (const page of pagesResult.data) {
      if (page.status !== "Published") continue;
      const route = page.route.startsWith("/") ? page.route : `/${page.route}`;
      // Skip known static routes
      if (["/", "/blog", "/cv"].includes(route)) continue;
      if (route.startsWith("/legal/")) continue;
      urls.push({
        loc: `${siteUrl}${route}/`,
        lastmod: page.created_at.split("T")[0],
        changefreq: "monthly",
        priority: "0.5",
      });
    }
  } catch {
    // Continue with partial sitemap
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${u.changefreq ? `\n    <changefreq>${u.changefreq}</changefreq>` : ""}${u.priority ? `\n    <priority>${u.priority}</priority>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
