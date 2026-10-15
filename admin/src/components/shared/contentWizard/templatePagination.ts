export interface SearchableTemplate {
  name: string;
  description: string;
}

/** Case-insensitive name/description match; a blank query keeps every template. */
export function filterTemplates<T extends SearchableTemplate>(templates: T[], query: string): T[] {
  if (!query.trim()) return templates;
  const q = query.toLowerCase();
  return templates.filter(
    (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
  );
}

export interface TemplatePageSlice<T> {
  pageItems: T[];
  totalPages: number;
  /** Requested page clamped to the last available page. */
  currentPage: number;
}

export function paginateTemplates<T>(items: T[], page: number, perPage: number): TemplatePageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  return {
    pageItems: items.slice(currentPage * perPage, (currentPage + 1) * perPage),
    totalPages,
    currentPage,
  };
}
