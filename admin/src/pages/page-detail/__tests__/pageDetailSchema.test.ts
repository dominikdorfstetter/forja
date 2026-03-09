import { describe, it, expect } from 'vitest';
import { pageDetailSchema } from '../pageDetailSchema';

const validData = {
  route: '/about',
  slug: 'about',
  page_type: 'Static' as const,
  template: '',
  status: 'Draft' as const,
  is_in_navigation: false,
  navigation_order: '',
  parent_page_id: '',
  publish_start: null,
  publish_end: null,
  meta_title: '',
  meta_description: '',
  excerpt: '',
};

describe('pageDetailSchema', () => {
  it('accepts valid data with empty SEO fields', () => {
    const result = pageDetailSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('accepts valid SEO metadata within limits', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      meta_title: 'My Page Title',
      meta_description: 'A description that helps search engines.',
      excerpt: 'Short excerpt of the page content.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects meta_title exceeding 60 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      meta_title: 'a'.repeat(61),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('meta_title');
    }
  });

  it('rejects meta_description exceeding 160 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      meta_description: 'a'.repeat(161),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('meta_description');
    }
  });

  it('rejects excerpt exceeding 300 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      excerpt: 'a'.repeat(301),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('excerpt');
    }
  });

  it('accepts meta_title at exactly 60 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      meta_title: 'a'.repeat(60),
    });
    expect(result.success).toBe(true);
  });

  it('accepts meta_description at exactly 160 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      meta_description: 'a'.repeat(160),
    });
    expect(result.success).toBe(true);
  });

  it('accepts excerpt at exactly 300 characters', () => {
    const result = pageDetailSchema.safeParse({
      ...validData,
      excerpt: 'a'.repeat(300),
    });
    expect(result.success).toBe(true);
  });
});
