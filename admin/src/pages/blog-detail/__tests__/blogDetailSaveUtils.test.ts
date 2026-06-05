import { describe, it, expect } from 'vitest';
import type { BlogDetailResponse } from '@/types/api';
import { buildBlogUpdates } from '../blogDetailSaveUtils';
import type { BlogContentFormData } from '../blogDetailSchema';

const baseDetail = {
  id: 'blog-1',
  content_id: 'content-1',
  slug: 'hello-world',
  author: 'Author',
  status: 'Published',
  is_featured: false,
  allow_comments: true,
  reading_time_minutes: 5,
  publish_start: null,
  publish_end: null,
  published_date: '2026-01-01',
  cover_image_id: null,
  header_image_id: null,
} as unknown as BlogDetailResponse;

const baseValues: BlogContentFormData = {
  title: 'Hello, World',
  subtitle: '',
  excerpt: '',
  body: '# Body',
  meta_title: '',
  meta_description: '',
  author: 'Author',
  published_date: '2026-01-01',
  status: 'Published',
  is_featured: false,
  allow_comments: true,
  reading_time_minutes: 5,
  reading_time_override: true,
  publish_start: null,
  publish_end: null,
  cover_image_id: null,
  header_image_id: null,
};

describe('buildBlogUpdates status diffing', () => {
  // #783: re-saving an already-Published blog must NOT resend `status`,
  // otherwise the backend publish gate re-runs on every edit and blocks
  // partially-localized published content.
  it('omits status when it is unchanged', () => {
    const updates = buildBlogUpdates(baseValues, baseDetail);
    expect(updates).not.toHaveProperty('status');
  });

  it('includes status when it genuinely changed', () => {
    const updates = buildBlogUpdates({ ...baseValues, status: 'Archived' }, baseDetail);
    expect(updates.status).toBe('Archived');
  });

  it('sends only the changed field, not status, on a plain metadata edit', () => {
    const updates = buildBlogUpdates({ ...baseValues, author: 'New Author' }, baseDetail);
    expect(updates).toEqual({ author: 'New Author' });
  });
});
