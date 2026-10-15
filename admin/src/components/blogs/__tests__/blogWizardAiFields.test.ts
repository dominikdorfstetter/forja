import { describe, it, expect } from 'vitest';
import { charCounter, isAiSectionLocked } from '../blogWizardAiFields';

describe('charCounter', () => {
  it('formats the count and turns red above 90% of the limit', () => {
    expect(charCounter('abc', 10)).toEqual({ text: '3 / 10', color: 'text.secondary' });
    expect(charCounter('abcdefghij', 10)).toEqual({ text: '10 / 10', color: 'error.main' });
  });
});

describe('isAiSectionLocked', () => {
  it('never locks when idle', () => {
    expect(isAiSectionLocked('body', false, null)).toBe(false);
  });

  it('locks every section while generating or regenerating everything', () => {
    for (const section of ['body', 'excerpt', 'seo'] as const) {
      expect(isAiSectionLocked(section, true, null)).toBe(true);
      expect(isAiSectionLocked(section, true, 'all')).toBe(true);
    }
  });

  it('locks only the section being regenerated', () => {
    expect(isAiSectionLocked('seo', true, 'seo')).toBe(true);
    expect(isAiSectionLocked('body', true, 'seo')).toBe(false);
    expect(isAiSectionLocked('excerpt', true, 'seo')).toBe(false);
    expect(isAiSectionLocked('excerpt', true, 'body')).toBe(false);
  });
});
