/**
 * ARIA and accessibility helpers for section components.
 * These utilities help maintain consistent accessible markup across all sections.
 */

/** Build an aria-label from a title, falling back to a generic section description. */
export function sectionLabel(title: string | undefined, fallback: string): string {
  return title?.trim() || fallback;
}

/**
 * Generate a unique ID for linking headings to their content.
 * Uses a slug derived from the title, or a random suffix if no title is provided.
 */
export function sectionId(title: string | undefined, prefix: string): string {
  if (title) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${prefix}-${slug}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
