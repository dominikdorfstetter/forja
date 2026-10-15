import type { TFunction } from 'i18next';

type Settings = Record<string, unknown>;

/** Maps a settings bag to one summary label, or `null` when it contributes none. */
type SummaryRule = (settings: Settings) => string | null;

function summarize(rules: SummaryRule[], settings: unknown): string[] {
  if (!settings) return [];
  return rules.flatMap((rule) => {
    const label = rule(settings as Settings);
    return label === null ? [] : [label];
  });
}

const PREVIEW_CHIP_RULES: SummaryRule[] = [
  (s) => (s.fullWidth ? 'Full Width' : null),
  (s) => (typeof s.columns === 'number' ? `${s.columns} columns` : null),
  (s) => (typeof s.gradient === 'string' && s.gradient ? 'Gradient' : null),
  (s) => (typeof s.style === 'string' ? s.style : null),
  (s) => (typeof s.layout === 'string' ? s.layout : null),
  (s) => (s.showCaptions ? 'Captions' : null),
  (s) => (s.showAvatar ? 'Avatar' : null),
  (s) => (s.showToggle ? 'Pricing Toggle' : null),
  (s) => (s.accordion ? 'Accordion' : null),
  (s) => (s.showMap ? 'Map' : null),
];

/** Settings chips shown on the page-preview card of a section. */
export function previewSettingsChips(settings: unknown): string[] {
  return summarize(PREVIEW_CHIP_RULES, settings);
}

/** Compact settings summary shown next to the type chip in the sections list. */
export function rowSettingsSummary(settings: unknown, t: TFunction): string[] {
  return summarize(
    [
      (s) => (typeof s.columns === 'number' ? t('sectionEditor.nColumns', { n: s.columns }) : null),
      (s) => (typeof s.style === 'string' ? s.style : null),
      (s) => (typeof s.layout === 'string' ? s.layout : null),
      (s) => (s.fullWidth ? t('sectionEditor.fullWidth') : null),
    ],
    settings,
  );
}
