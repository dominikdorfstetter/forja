import type { Tag } from '@/types/api';

/** Whitespace-split word count of a blog body (empty body → 0). */
export function countWords(body: string): number {
  return body ? body.split(/\s+/).filter(Boolean).length : 0;
}

/** Case-insensitive lookup of a tag by slug. */
export function findTagBySlug(tags: Tag[], slug: string): Tag | undefined {
  const lower = slug.toLowerCase();
  return tags.find((tag) => tag.slug.toLowerCase() === lower);
}
