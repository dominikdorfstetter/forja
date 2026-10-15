/** Page id → public route, used to label page links. */
export function buildPageRouteMap(pages: { id: string; route: string }[] | undefined): Map<string, string> {
  return new Map((pages ?? []).map((page) => [page.id, page.route]));
}

/** Legal document id → `/legal/{slug}` (cookie name as slug fallback). */
export function buildLegalRouteMap(
  docs: { id: string; slug?: string | null; cookie_name: string }[] | undefined,
): Map<string, string> {
  return new Map(
    (docs ?? []).flatMap((doc) => {
      const slug = doc.slug || doc.cookie_name;
      return slug ? [[doc.id, `/legal/${slug}`] as const] : [];
    }),
  );
}
