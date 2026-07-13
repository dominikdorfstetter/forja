import { z } from 'zod';
import type { TFunction } from 'i18next';
import type {
  CreateUiStringRequest,
  SiteLocaleResponse,
  UiStringLocalizationInput,
  UiStringResponse,
  UpdateUiStringRequest,
} from '@/types/api';

/** Mirrors the backend validation constants (dto/ui_strings.rs) for instant
 *  client-side feedback — the backend still enforces them (422). */
export const UI_STRING_KEY_MAX_LEN = 128;
export const UI_STRING_VALUE_MAX_LEN = 1000;
export const UI_STRING_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** RHF shape of the dialog: only the key rides in the form — the per-locale
 *  values are a draft map keyed by locale id (MenuFormDialog pattern). */
export interface UiStringKeyFormData {
  key: string;
}

export const buildUiStringKeySchema = (t: TFunction) =>
  z.object({
    key: z
      .string()
      .min(1, t('uiStrings.dialog.keyRequired'))
      .max(UI_STRING_KEY_MAX_LEN, t('uiStrings.dialog.keyTooLong'))
      .regex(UI_STRING_KEY_PATTERN, t('uiStrings.dialog.keyInvalid')),
  });

/** Draft values per locale id, as edited in the dialog. */
export type LocaleValueDraft = Record<string, string>;

/** Persisted values keyed by locale id — the dialog's edit-mode baseline. */
export const persistedLocaleValues = (row?: UiStringResponse | null): LocaleValueDraft =>
  Object.fromEntries((row?.localizations ?? []).map((l) => [l.locale_id, l.value]));

const draftValue = (draft: LocaleValueDraft, localeId: string) => draft[localeId] ?? '';

/** Create ships the key plus a localization for every locale the user filled. */
export function buildCreatePayload(
  key: string,
  draft: LocaleValueDraft,
  locales: SiteLocaleResponse[],
): CreateUiStringRequest {
  return {
    key,
    localizations: locales.flatMap((locale) => {
      const value = draftValue(draft, locale.locale_id);
      return value.trim().length > 0 ? [{ locale_id: locale.locale_id, value }] : [];
    }),
  };
}

export interface UpdateDelta {
  localizations: UiStringLocalizationInput[];
  removedLocaleIds: string[];
}

export const deltaHasChanges = (delta: UpdateDelta): boolean =>
  delta.localizations.length > 0 || delta.removedLocaleIds.length > 0;

/**
 * Diff the draft against the persisted row. Only actual edits ride in the
 * PUT — locales present in the payload are exempt from the backend's
 * auto-outdated flip, so sending unchanged values would silently confirm
 * translations nobody looked at. The exception: an unchanged-but-outdated
 * value the user explicitly touched is re-sent as the confirm that clears
 * the flag. A cleared, previously-persisted value becomes a removal
 * (`removed_locale_ids`); clearing the default is blocked in the dialog.
 */
export function computeUpdateDelta(
  row: UiStringResponse,
  draft: LocaleValueDraft,
  touchedLocaleIds: ReadonlySet<string>,
  locales: SiteLocaleResponse[],
): UpdateDelta {
  return locales.reduce<UpdateDelta>(
    (delta, locale) => {
      const value = draftValue(draft, locale.locale_id);
      const persisted = row.localizations.find((l) => l.locale_id === locale.locale_id);
      if (value.trim().length === 0) {
        return persisted && persisted.value.length > 0
          ? { ...delta, removedLocaleIds: [...delta.removedLocaleIds, locale.locale_id] }
          : delta;
      }
      const changed = value !== (persisted?.value ?? '');
      const outdatedConfirm =
        !changed &&
        persisted?.translation_status === 'Outdated' &&
        touchedLocaleIds.has(locale.locale_id);
      return changed || outdatedConfirm
        ? {
            ...delta,
            localizations: [...delta.localizations, { locale_id: locale.locale_id, value }],
          }
        : delta;
    },
    { localizations: [], removedLocaleIds: [] },
  );
}

export function buildUpdatePayload(
  key: string,
  keyDirty: boolean,
  delta: UpdateDelta,
): UpdateUiStringRequest {
  return {
    key: keyDirty ? key : undefined,
    localizations: delta.localizations,
    removed_locale_ids: delta.removedLocaleIds.length > 0 ? delta.removedLocaleIds : undefined,
  };
}
