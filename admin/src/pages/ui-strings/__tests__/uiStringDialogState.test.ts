import { describe, expect, it } from 'vitest';

import { defaultValueMissing, isSubmitBlocked, localeValueFieldState } from '../uiStringForm';
import { rowMinRead } from './fixtures';

const noChanges = { localizations: [], removedLocaleIds: [] };
const oneChange = { localizations: [{ locale_id: 'loc-de', value: 'Neu' }], removedLocaleIds: [] };

describe('defaultValueMissing', () => {
  it('treats an absent or whitespace-only default value as missing', () => {
    expect(defaultValueMissing({}, 'loc-en')).toBe(true);
    expect(defaultValueMissing({ 'loc-en': '   ' }, 'loc-en')).toBe(true);
    expect(defaultValueMissing({ 'loc-en': 'min read' }, 'loc-en')).toBe(false);
  });
});

describe('isSubmitBlocked', () => {
  it('blocks an invalid key or a missing default value', () => {
    expect(isSubmitBlocked({ isValid: false, keyDirty: true, defaultMissing: false, delta: oneChange })).toBe(true);
    expect(isSubmitBlocked({ isValid: true, keyDirty: true, defaultMissing: true, delta: oneChange })).toBe(true);
  });

  it('lets a valid create through (no delta)', () => {
    expect(isSubmitBlocked({ isValid: true, keyDirty: false, defaultMissing: false, delta: undefined })).toBe(false);
  });

  it('blocks an edit that changes nothing, allows a key or value change', () => {
    expect(isSubmitBlocked({ isValid: true, keyDirty: false, defaultMissing: false, delta: noChanges })).toBe(true);
    expect(isSubmitBlocked({ isValid: true, keyDirty: true, defaultMissing: false, delta: noChanges })).toBe(false);
    expect(isSubmitBlocked({ isValid: true, keyDirty: false, defaultMissing: false, delta: oneChange })).toBe(false);
  });
});

describe('localeValueFieldState', () => {
  it('reads the draft value and flags a cleared persisted value', () => {
    const field = localeValueFieldState(rowMinRead, { 'loc-de': ' ' }, new Set(), 'loc-de', false);
    expect(field).toEqual({ value: ' ', cleared: true, showRequiredError: false });
  });

  it('does not flag clearing a locale that had no persisted value', () => {
    const field = localeValueFieldState(rowMinRead, {}, new Set(), 'loc-fr', false);
    expect(field).toEqual({ value: '', cleared: false, showRequiredError: false });
  });

  it('shows the required error for an empty default in edit mode right away', () => {
    expect(localeValueFieldState(rowMinRead, {}, new Set(), 'loc-en', true).showRequiredError).toBe(true);
  });

  it('shows the required error in create mode only once the default was touched', () => {
    expect(localeValueFieldState(null, {}, new Set(), 'loc-en', true).showRequiredError).toBe(false);
    expect(localeValueFieldState(null, {}, new Set(['loc-en']), 'loc-en', true).showRequiredError).toBe(true);
  });
});
