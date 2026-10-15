import { describe, it, expect } from 'vitest';
import type { Tag } from '@/types/api';
import { countWords, findTagBySlug } from '../blogTagUtils';

const rust: Tag = { id: 'tag-1', slug: 'Rust', is_global: false, created_at: '2026-01-01T00:00:00Z' };

describe('blogTagUtils', () => {
  it('counts whitespace-separated words and treats an empty body as zero', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  one   two\nthree ')).toBe(3);
  });

  it('finds a tag by slug case-insensitively', () => {
    expect(findTagBySlug([rust], 'rust')).toBe(rust);
    expect(findTagBySlug([rust], 'axum')).toBeUndefined();
  });
});
