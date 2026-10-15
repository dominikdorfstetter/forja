import { describe, it, expect } from 'vitest';
import { filterTemplates, paginateTemplates } from '../templatePagination';

const templates = [
  { name: 'Tutorial', description: 'Step-by-step guide' },
  { name: 'Changelog', description: 'Release notes' },
  { name: 'Review', description: 'Product review' },
];

describe('filterTemplates', () => {
  it('returns every template for a blank query', () => {
    expect(filterTemplates(templates, '   ')).toBe(templates);
  });

  it('matches name or description case-insensitively', () => {
    expect(filterTemplates(templates, 'TUTOR').map((t) => t.name)).toEqual(['Tutorial']);
    expect(filterTemplates(templates, 'release').map((t) => t.name)).toEqual(['Changelog']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterTemplates(templates, 'zzz')).toEqual([]);
  });
});

describe('paginateTemplates', () => {
  const items = [1, 2, 3, 4, 5];

  it('slices the requested page', () => {
    expect(paginateTemplates(items, 1, 4)).toEqual({ pageItems: [5], totalPages: 2, currentPage: 1 });
  });

  it('clamps a page past the end to the last page', () => {
    expect(paginateTemplates(items, 7, 4)).toEqual({ pageItems: [5], totalPages: 2, currentPage: 1 });
  });

  it('reports a single page for an empty list', () => {
    expect(paginateTemplates([], 0, 4)).toEqual({ pageItems: [], totalPages: 1, currentPage: 0 });
  });
});
