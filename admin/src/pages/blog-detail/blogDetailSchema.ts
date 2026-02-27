import { z } from 'zod';

export const blogContentSchema = z.object({
  // Per-locale content
  title: z.string().min(1),
  subtitle: z.string(),
  excerpt: z.string(),
  body: z.string(),
  meta_title: z.string().max(60),
  meta_description: z.string().max(160),
  // Blog-level metadata
  author: z.string().min(1),
  published_date: z.string().min(1),
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
  is_featured: z.boolean(),
  allow_comments: z.boolean(),
  reading_time_minutes: z.number().nullable().optional(),
  reading_time_override: z.boolean().optional(),
  publish_start: z.string().nullable().optional(),
  publish_end: z.string().nullable().optional(),
});

export type BlogContentFormData = z.infer<typeof blogContentSchema>;

/** Calculate reading time from markdown body (~200 words per minute) */
export function calculateReadingTime(markdown: string | undefined): number {
  if (!markdown) return 0;
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export interface TocItem {
  level: number;
  text: string;
}

export function parseToc(body: string | undefined): TocItem[] {
  if (!body) return [];
  const lines = body.split('\n');
  const items: TocItem[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      items.push({ level: match[1].length, text: match[2] });
    }
  }
  return items;
}
