import type { ReactNode } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import LocaleAwareFields, {
  type LocaleFieldSpec,
  type LocalizationRow,
} from './LocaleAwareFields';

/** Labels for the three SEO fields (entity i18n namespaces differ). */
export interface SeoFieldLabels {
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
}

/** The canonical SEO field spec — meta title / description / excerpt — shared by
 *  every content type's SEO tab. Limits + counters match the prior hand-written
 *  fields in Blog/Page SEO tabs. */
export function seoFieldSpecs(labels: SeoFieldLabels, testIdPrefix = 'seo'): LocaleFieldSpec[] {
  return [
    {
      name: 'meta_title',
      label: labels.metaTitle,
      maxLength: 70,
      counterMax: 60,
      testId: `${testIdPrefix}.meta-title`,
    },
    {
      name: 'meta_description',
      label: labels.metaDescription,
      maxLength: 200,
      counterMax: 160,
      multiline: true,
      rows: 3,
      testId: `${testIdPrefix}.meta-description`,
    },
    {
      name: 'excerpt',
      label: labels.excerpt,
      maxLength: 300,
      counterMax: 300,
      multiline: true,
      rows: 2,
      testId: `${testIdPrefix}.excerpt`,
    },
  ];
}

export interface SeoFieldsEditorProps<TForm extends FieldValues> {
  control: Control<TForm>;
  isDefault: boolean;
  onDefaultBlur: () => void;
  labels: SeoFieldLabels;
  testIdPrefix?: string;
  /** AI generate buttons (or any footer) for the default-locale path, keyed by
   *  field name (`meta_description`, `excerpt`). */
  footerSlots?: Record<string, ReactNode>;

  locale: { id: string; code: string };
  localization?: LocalizationRow;
  createLocalization: (localeId: string, values: Record<string, string>) => Promise<unknown>;
  updateLocalization: (locId: string, values: Record<string, string>) => Promise<unknown>;
  invalidateKey: readonly unknown[];
  placeholders?: Record<string, string>;
  localeHint?: string;
  onLocaleValuesChange?: (values: Record<string, string>) => void;
}

/** Thin SEO-flavoured composition of {@link LocaleAwareFields}: fixes the three
 *  SEO field specs and forwards the persistence wiring. */
export default function SeoFieldsEditor<TForm extends FieldValues>({
  labels,
  testIdPrefix = 'seo',
  ...rest
}: SeoFieldsEditorProps<TForm>) {
  return <LocaleAwareFields fields={seoFieldSpecs(labels, testIdPrefix)} {...rest} />;
}
