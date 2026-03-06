export const MAX_SLUG_LENGTH = 80;

/**
 * Converts text to a URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\w\s-]/g, '')        // strip non-word chars
    .replace(/[\s_]+/g, '-')         // spaces/underscores → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
    .slice(0, MAX_SLUG_LENGTH);
}
