import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { previewSettingsChips, rowSettingsSummary } from '../sectionSettingsSummary';

const t = ((key: string, opts?: { n?: number }) => (opts?.n !== undefined ? `${key}:${opts.n}` : key)) as unknown as TFunction;

describe('previewSettingsChips', () => {
  it('returns no chips without settings', () => {
    expect(previewSettingsChips(undefined)).toEqual([]);
    expect(previewSettingsChips(null)).toEqual([]);
  });

  it('lists chips for the set settings in a fixed order', () => {
    expect(previewSettingsChips({
      showMap: true,
      columns: 3,
      fullWidth: true,
      gradient: 'linear',
      style: 'card',
      layout: 'grid',
      showCaptions: true,
      showAvatar: true,
      showToggle: true,
      accordion: true,
    })).toEqual([
      'Full Width', '3 columns', 'Gradient', 'card', 'grid',
      'Captions', 'Avatar', 'Pricing Toggle', 'Accordion', 'Map',
    ]);
  });

  it('skips falsy flags and empty gradients but keeps empty style strings', () => {
    expect(previewSettingsChips({ fullWidth: false, gradient: '', style: '', columns: '3' })).toEqual(['']);
  });
});

describe('rowSettingsSummary', () => {
  it('returns nothing without settings', () => {
    expect(rowSettingsSummary(undefined, t)).toEqual([]);
  });

  it('summarizes columns, style, layout and full width', () => {
    expect(rowSettingsSummary({ fullWidth: true, layout: 'grid', style: 'card', columns: 2 }, t)).toEqual([
      'sectionEditor.nColumns:2', 'card', 'grid', 'sectionEditor.fullWidth',
    ]);
  });
});
