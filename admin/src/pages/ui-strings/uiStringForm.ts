import { z } from 'zod';
import type { TFunction } from 'i18next';
import type {
  CreateUiStringRequest,
  UiStringLocalizationInput,
  UpdateUiStringRequest,
} from '@/types/api';

/** Mirrors the backend validation constants (dto/ui_strings.rs) for instant
 *  client-side feedback — the backend still enforces them (422). */
export const UI_STRING_KEY_MAX_LEN = 128;
export const UI_STRING_VALUE_MAX_LEN = 1000;
export const UI_STRING_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export interface UiStringFormData {
  key: string;
  /** Default-locale value; non-default locales persist per-locale on blur. */
  value: string;
}

/** `requireValue` (edit mode): the API can only upsert localizations, never
 *  clear one — an emptied default value would be dropped silently, so block
 *  it client-side instead. Creation may start with just the key. */
export const buildUiStringSchema = (t: TFunction, requireValue = false) => {
  const value = z.string().max(UI_STRING_VALUE_MAX_LEN, t('uiStrings.detail.valueTooLong'));
  return z.object({
    key: z
      .string()
      .min(1, t('uiStrings.detail.keyRequired'))
      .max(UI_STRING_KEY_MAX_LEN, t('uiStrings.detail.keyTooLong'))
      .regex(UI_STRING_KEY_PATTERN, t('uiStrings.detail.keyInvalid')),
    value: requireValue ? value.min(1, t('uiStrings.detail.valueRequired')) : value,
  });
};

const defaultLocalization = (values: UiStringFormData, defaultLocaleId: string | undefined) =>
  defaultLocaleId && values.value.trim().length > 0
    ? [{ locale_id: defaultLocaleId, value: values.value }]
    : [];

export function buildCreatePayload(
  values: UiStringFormData,
  defaultLocaleId: string | undefined,
): CreateUiStringRequest {
  return { key: values.key, localizations: defaultLocalization(values, defaultLocaleId) };
}

/** `pendingLocalizations` ride in the same PUT as the default value so the
 *  backend's auto-outdated flip exempts them — a translation edited in this
 *  session is not instantly flagged outdated by its own save. */
export function buildUpdatePayload(
  values: UiStringFormData,
  dirty: { key?: boolean; value?: boolean },
  defaultLocaleId: string | undefined,
  pendingLocalizations: UiStringLocalizationInput[] = [],
): UpdateUiStringRequest {
  return {
    key: dirty.key ? values.key : undefined,
    localizations: [
      ...(dirty.value ? defaultLocalization(values, defaultLocaleId) : []),
      ...pendingLocalizations,
    ],
  };
}
