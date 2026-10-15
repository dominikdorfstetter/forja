import type { SectionType } from '@/types/api';

/** Free-form `section.settings` bag as stored on the section. */
export type SectionSettings = Record<string, unknown>;

export interface SettingsSelectOption {
  value: string | number;
  /** i18n key for the option label; omitted → the raw value is the label. */
  labelKey?: string;
  labelParams?: Record<string, unknown>;
}

export type SettingsFieldDescriptor =
  | { kind: 'switch'; key: string; labelKey: string; fallback: boolean }
  | { kind: 'text'; key: string; labelKey: string; helperKey: string; fallback: string }
  /** A numeric `fallback` makes the select read and write numbers. */
  | { kind: 'select'; key: string; labelKey: string; fallback: string | number; options: SettingsSelectOption[] }
  /** Raw JSON editor over the whole settings object. */
  | { kind: 'json'; helperKey: string };

export interface SectionSettingsDescriptor {
  titleKey: string;
  fields: SettingsFieldDescriptor[];
}

const switchField = (key: string, labelKey: string, fallback = false): SettingsFieldDescriptor => ({
  kind: 'switch',
  key,
  labelKey,
  fallback,
});

const selectField = (
  key: string,
  labelKey: string,
  fallback: string,
  options: [value: string, labelKey?: string][],
): SettingsFieldDescriptor => ({
  kind: 'select',
  key,
  labelKey,
  fallback,
  options: options.map(([value, optionLabelKey]) => ({ value, labelKey: optionLabelKey })),
});

const columnsField = (counts: number[], fallback = 3): SettingsFieldDescriptor => ({
  kind: 'select',
  key: 'columns',
  labelKey: 'sectionEditor.columns',
  fallback,
  options: counts.map((n) => ({ value: n, labelKey: 'sectionEditor.nColumns', labelParams: { n } })),
});

/** Per-section-type settings fields, in render order. Types without an entry have no settings. */
export const SECTION_SETTINGS_FIELDS: Partial<Record<SectionType, SectionSettingsDescriptor>> = {
  Hero: {
    titleKey: 'sectionEditor.settings.hero.title',
    fields: [
      switchField('fullWidth', 'sectionEditor.fullWidth'),
      {
        kind: 'text',
        key: 'gradient',
        labelKey: 'sectionEditor.settings.hero.gradient',
        helperKey: 'sectionEditor.settings.hero.gradientHint',
        fallback: '',
      },
    ],
  },
  Features: {
    titleKey: 'sectionEditor.settings.features.title',
    fields: [columnsField([2, 3, 4])],
  },
  Cta: {
    titleKey: 'sectionEditor.settings.cta.title',
    fields: [
      selectField('style', 'sectionEditor.style', 'banner', [
        ['banner', 'sectionEditor.settings.cta.banner'],
        ['card', 'sectionEditor.settings.cta.card'],
        ['floating', 'sectionEditor.settings.cta.floating'],
      ]),
    ],
  },
  Gallery: {
    titleKey: 'sectionEditor.settings.gallery.title',
    fields: [
      columnsField([2, 3, 4]),
      switchField('showCaptions', 'sectionEditor.settings.gallery.showCaptions'),
    ],
  },
  Testimonials: {
    titleKey: 'sectionEditor.settings.testimonials.title',
    fields: [
      selectField('layout', 'sectionEditor.layout', 'carousel', [
        ['carousel', 'sectionEditor.settings.testimonials.carousel'],
        ['grid', 'sectionEditor.settings.testimonials.grid'],
      ]),
      switchField('showAvatar', 'sectionEditor.settings.testimonials.showAvatar'),
    ],
  },
  Pricing: {
    titleKey: 'sectionEditor.settings.pricing.title',
    fields: [
      columnsField([2, 3, 4]),
      switchField('showToggle', 'sectionEditor.settings.pricing.showToggle'),
    ],
  },
  Faq: {
    titleKey: 'sectionEditor.settings.faq.title',
    fields: [switchField('accordion', 'sectionEditor.settings.faq.accordion', true)],
  },
  Contact: {
    titleKey: 'sectionEditor.settings.contact.title',
    fields: [
      switchField('showMap', 'sectionEditor.settings.contact.showMap'),
      {
        kind: 'text',
        key: 'formFields',
        labelKey: 'sectionEditor.settings.contact.formFields',
        helperKey: 'sectionEditor.settings.contact.formFieldsHint',
        fallback: 'name,email,message',
      },
    ],
  },
  Custom: {
    titleKey: 'sectionEditor.settings.custom.title',
    fields: [{ kind: 'json', helperKey: 'sectionEditor.settings.custom.jsonHint' }],
  },
  Stats: {
    titleKey: 'sectionEditor.settings.stats.title',
    fields: [
      columnsField([2, 3, 4]),
      selectField('style', 'sectionEditor.style', 'card', [
        ['card', 'sectionEditor.settings.stats.cardStyle'],
        ['inline', 'sectionEditor.settings.stats.inlineStyle'],
      ]),
    ],
  },
  Team: {
    titleKey: 'sectionEditor.settings.team.title',
    fields: [
      columnsField([2, 3, 4]),
      switchField('showRole', 'sectionEditor.settings.team.showRole', true),
      switchField('showBio', 'sectionEditor.settings.team.showBio', true),
    ],
  },
  Timeline: {
    titleKey: 'sectionEditor.settings.timeline.title',
    fields: [
      selectField('layout', 'sectionEditor.layout', 'vertical', [
        ['vertical', 'sectionEditor.settings.timeline.vertical'],
        ['horizontal', 'sectionEditor.settings.timeline.horizontal'],
      ]),
      switchField('showDates', 'sectionEditor.settings.timeline.showDates', true),
    ],
  },
  LogoCloud: {
    titleKey: 'sectionEditor.settings.logoCloud.title',
    fields: [
      columnsField([3, 4, 5, 6], 4),
      switchField('grayscale', 'sectionEditor.settings.logoCloud.grayscale'),
    ],
  },
  Newsletter: {
    titleKey: 'sectionEditor.settings.newsletter.title',
    fields: [
      selectField('provider', 'sectionEditor.provider', 'generic', [
        ['generic', 'sectionEditor.settings.newsletter.generic'],
        ['mailchimp', 'sectionEditor.settings.newsletter.mailchimp'],
        ['custom', 'sectionEditor.settings.newsletter.customProvider'],
      ]),
      switchField('showName', 'sectionEditor.settings.newsletter.showName'),
    ],
  },
  Video: {
    titleKey: 'sectionEditor.settings.video.title',
    fields: [
      selectField('provider', 'sectionEditor.provider', 'youtube', [
        ['youtube', 'sectionEditor.settings.video.youtube'],
        ['vimeo', 'sectionEditor.settings.video.vimeo'],
        ['self-hosted', 'sectionEditor.settings.video.selfHosted'],
      ]),
      switchField('autoplay', 'sectionEditor.settings.video.autoplay'),
      selectField('aspectRatio', 'sectionEditor.settings.video.aspectRatio', '16:9', [['16:9'], ['4:3'], ['1:1']]),
    ],
  },
  Divider: {
    titleKey: 'sectionEditor.settings.divider.title',
    fields: [
      selectField('style', 'sectionEditor.style', 'line', [
        ['line', 'sectionEditor.settings.divider.line'],
        ['dots', 'sectionEditor.settings.divider.dots'],
        ['space', 'sectionEditor.settings.divider.space'],
      ]),
      switchField('label', 'sectionEditor.settings.divider.showLabel'),
    ],
  },
  Text: {
    titleKey: 'sectionEditor.settings.text.title',
    fields: [
      selectField('width', 'sectionEditor.settings.text.width', 'default', [
        ['narrow', 'sectionEditor.settings.text.narrow'],
        ['default', 'sectionEditor.settings.text.default'],
        ['wide', 'sectionEditor.settings.text.wide'],
      ]),
      selectField('alignment', 'sectionEditor.settings.text.alignment', 'left', [
        ['left', 'sectionEditor.settings.text.left'],
        ['center', 'sectionEditor.settings.text.center'],
      ]),
    ],
  },
};

export function readBool(settings: SectionSettings, key: string, fallback: boolean): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function readString(settings: SectionSettings, key: string, fallback: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(settings: SectionSettings, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === 'number' ? value : fallback;
}
