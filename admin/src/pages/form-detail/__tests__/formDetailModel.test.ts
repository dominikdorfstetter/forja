import { describe, it, expect } from 'vitest';
import type { FormDetailResponse } from '@/types/api';
import {
  draftFromForm,
  isDraftDirty,
  parseRetentionDays,
  savePayload,
} from '../formDetailModel';

const form: FormDetailResponse = {
  id: 'form-1',
  site_id: 'site-1',
  name: 'Contact',
  slug: 'contact',
  description: 'Reach us',
  is_active: true,
  consent_required: false,
  consent_text: null,
  bot_protection: 'none',
  storage_mode: 'simple',
  retention_days: null,
  fields: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('formDetailModel', () => {
  it('seeds a draft with blank strings for nullable settings', () => {
    const draft = draftFromForm(form);
    expect(draft.settings).toMatchObject({ consent_text: '', retention_days: '' });
    expect(draft.fields).toEqual([]);
    expect(draft.localizations).toEqual([]);
  });

  it('is clean and produces an empty payload when nothing changed', () => {
    const original = draftFromForm(form);
    expect(isDraftDirty(original, original)).toBe(false);
    expect(isDraftDirty(null, original)).toBe(false);
    expect(savePayload(original, original)).toEqual({});
  });

  it('sends only changed settings, mapping blank text and retention to null', () => {
    const original = draftFromForm({ ...form, retention_days: 30 });
    const draft = {
      ...original,
      settings: { ...original.settings, name: 'Contact Us', description: '  ', retention_days: '' as const },
    };
    expect(isDraftDirty(draft, original)).toBe(true);
    expect(savePayload(draft, original)).toEqual({
      name: 'Contact Us',
      description: null,
      retention_days: null,
    });
  });

  it('includes the full fields and localizations arrays only when they changed', () => {
    const original = draftFromForm(form);
    const localizations = [{ locale_id: 'de', name: 'Kontakt', description: null, consent_text: null }];
    expect(savePayload({ ...original, localizations }, original)).toEqual({ localizations });
  });

  it('parses retention input: empty clears, numbers set, garbage is ignored', () => {
    expect(parseRetentionDays('')).toBe('');
    expect(parseRetentionDays('14')).toBe(14);
    expect(parseRetentionDays('abc')).toBeUndefined();
  });
});
