import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { CreateUiStringRequest, UpdateUiStringRequest } from '@/types/api';

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

export const buildUiStringSchema = (t: TFunction) =>
  z.object({
    key: z
      .string()
      .min(1, t('uiStrings.detail.keyRequired'))
      .max(UI_STRING_KEY_MAX_LEN, t('uiStrings.detail.keyTooLong'))
      .regex(UI_STRING_KEY_PATTERN, t('uiStrings.detail.keyInvalid')),
    value: z.string().max(UI_STRING_VALUE_MAX_LEN, t('uiStrings.detail.valueTooLong')),
  });

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

export function buildUpdatePayload(
  values: UiStringFormData,
  dirty: { key?: boolean; value?: boolean },
  defaultLocaleId: string | undefined,
): UpdateUiStringRequest {
  return {
    key: dirty.key ? values.key : undefined,
    localizations: dirty.value ? defaultLocalization(values, defaultLocaleId) : [],
  };
}
