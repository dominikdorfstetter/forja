import { describe, it, expect } from 'vitest';
import type { PageSectionResponse, SectionLocalizationResponse } from '@/types/api';
import {
  localeChipsFor,
  otherSectionTypes,
  primaryTitleFor,
  sortByDisplayOrder,
  stripMarkdown,
  subtitleFor,
  toReorderItems,
} from '../pageSectionsHelpers';

const sections: PageSectionResponse[] = [
  { id: 's2', page_id: 'p', section_type: 'Faq', display_order: 2 },
  { id: 's0', page_id: 'p', section_type: 'Hero', display_order: 0 },
  { id: 's1', page_id: 'p', section_type: 'Cta', display_order: 1 },
];

const locs: SectionLocalizationResponse[] = [
  { id: 'l1', page_section_id: 's0', locale_id: 'de', text: 'nur Text' },
  { id: 'l2', page_section_id: 's0', locale_id: 'en', title: 'Hello', text: `# Big **news**\n\n${'x'.repeat(80)}` },
  { id: 'l3', page_section_id: 's1', locale_id: 'fr', title: 'Bonjour' },
];

const locales = [{ id: 'en', code: 'en' }, { id: 'de', code: 'de' }];

describe('pageSectionsHelpers', () => {
  it('sorts by display order without mutating the input', () => {
    expect(sortByDisplayOrder(sections).map((s) => s.id)).toEqual(['s0', 's1', 's2']);
    expect(sections[0].id).toBe('s2');
  });

  it('maps a list to reorder items indexed by position', () => {
    expect(toReorderItems(sections)).toEqual([
      { id: 's2', display_order: 0 },
      { id: 's0', display_order: 1 },
      { id: 's1', display_order: 2 },
    ]);
  });

  it('lists active locales a section is localized in, upper-cased, in locale order', () => {
    expect(localeChipsFor('s0', locs, locales)).toEqual(['EN', 'DE']);
    expect(localeChipsFor('s1', locs, locales)).toEqual([]);
    expect(localeChipsFor('s0', undefined, locales)).toEqual([]);
    expect(localeChipsFor('s0', locs, [])).toEqual([]);
  });

  it('picks the first non-empty title', () => {
    expect(primaryTitleFor('s0', locs)).toBe('Hello');
    expect(primaryTitleFor('s2', locs)).toBeNull();
    expect(primaryTitleFor('s0', undefined)).toBeNull();
  });

  it('builds a plain-text subtitle truncated to 60 characters', () => {
    expect(subtitleFor('s0', locs)).toBe('nur Text');
    const long = subtitleFor('s0', [locs[1]]);
    expect(long).toBe(`Big news ${'x'.repeat(51)}...`);
    expect(subtitleFor('s1', locs)).toBeNull();
    expect(subtitleFor('s0', undefined)).toBeNull();
  });

  it('strips markdown syntax and collapses newlines', () => {
    expect(stripMarkdown('## Title\n\n- **bold** [link](url)')).toBe('Title  bold linkurl');
  });

  it('lists the other sections’ types in display order', () => {
    expect(otherSectionTypes(sections, 's1')).toEqual(['Hero', 'Faq']);
    expect(otherSectionTypes(undefined, 's1')).toEqual([]);
  });
});
