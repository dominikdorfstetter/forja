type Text = string | null | undefined;

/** SEO values of the page form (= the default locale). */
export interface SeoFormValues {
  meta_title: string;
  meta_description: string;
  excerpt: string;
}

export interface SeoPreviewInput {
  isDefaultLocale: boolean;
  /** Live, unsaved edits of the active non-default locale. */
  localeValues: Record<string, string>;
  /** Persisted localization of the active locale, if any. */
  localization: { meta_title?: Text; meta_description?: Text } | undefined;
  form: SeoFormValues;
  pageRoute: string;
  route: string;
}

/**
 * Title/description fed to the SERP + social previews: the form (default
 * locale) or — for a non-default locale — its live edits, then its persisted
 * localization, falling back to the default-locale fields.
 */
export function resolveSeoPreview({
  isDefaultLocale,
  localeValues,
  localization,
  form,
  pageRoute,
  route,
}: SeoPreviewInput): { title: string; description: string } {
  if (isDefaultLocale) {
    return {
      title: form.meta_title || pageRoute || route,
      description: form.meta_description || form.excerpt,
    };
  }
  return {
    title: localeValues.meta_title || localization?.meta_title || form.meta_title || pageRoute || route,
    description:
      localeValues.meta_description || localization?.meta_description || form.meta_description || form.excerpt,
  };
}

/** Default-locale values shown as placeholders in a non-default locale's empty fields. */
export function seoPlaceholders(form: SeoFormValues): Record<keyof SeoFormValues, string> {
  return {
    meta_title: form.meta_title || '',
    meta_description: form.meta_description || '',
    excerpt: form.excerpt || '',
  };
}
