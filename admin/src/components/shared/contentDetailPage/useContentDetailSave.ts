import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { FieldValues, UseFormGetValues, UseFormReset } from 'react-hook-form';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { entityIdOf } from './contentDetailHelpers';
import type { ContentDetailMutations } from './useContentDetailMutations';
import type { ActiveLocale, ContentDetailAdapter } from './types';

interface ContentDetailSaveOptions<TDetail, TFormData extends FieldValues, TLoc> {
  adapter: ContentDetailAdapter<TDetail, TFormData, TLoc>;
  detail: TDetail | undefined;
  currentLocale: ActiveLocale | undefined;
  currentLocalization: TLoc | undefined;
  getValues: UseFormGetValues<TFormData>;
  reset: UseFormReset<TFormData>;
  mutations: Pick<ContentDetailMutations, 'updateEntityMutation' | 'updateLocMutation' | 'createLocMutation'>;
}

/**
 * Persists the editor form: localization first, then entity-level updates,
 * then resets the form baseline. Returns a fire-and-forget `runSave` that
 * never rejects — per-leg errors are already surfaced by each mutation.
 */
export function useContentDetailSave<TDetail, TFormData extends FieldValues, TLoc>({
  adapter,
  detail,
  currentLocale,
  currentLocalization,
  getValues,
  reset,
  mutations,
}: ContentDetailSaveOptions<TDetail, TFormData, TLoc>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess } = useErrorSnackbar();
  const { updateEntityMutation, updateLocMutation, createLocMutation } = mutations;

  const handleSave = useCallback(async () => {
    if (!detail || !currentLocale) return;
    const values = getValues();
    const originalId = entityIdOf(detail);

    // Optional fork-on-save: legal auto-versions a published document, so the
    // save is routed onto a fresh draft version instead of mutating the
    // published record (#140). `target` carries the new entity id, the
    // matching localization id for the current locale, and where to navigate.
    const target = adapter.prepareSaveTarget
      ? await adapter.prepareSaveTarget(detail, currentLocale.id)
      : null;
    const detailId = target?.id ?? originalId;
    const targetLocId = target
      ? target.localizationId
      : (currentLocalization as unknown as { id: string } | undefined)?.id;

    // Save the localization first. The entity-status update can be rejected
    // by the backend publish gate (e.g. missing locale coverage); persisting
    // the translation before that attempt ensures the user's typed content is
    // never lost — and is the correct order when a publish adds the final
    // missing locale in the same save (the row must exist before the gate
    // runs). See #783.
    const locShouldSave = adapter.hasLocalizationChanges
      ? adapter.hasLocalizationChanges(values, currentLocalization)
      : true;

    if (locShouldSave) {
      const locData = adapter.buildLocalizationData(values);
      const titleField = adapter.getLocTitleField?.(values);
      const dataWithTitle = titleField !== undefined ? { title: titleField, ...locData } : locData;

      if (targetLocId) {
        await updateLocMutation.mutateAsync({ locId: targetLocId, data: dataWithTitle });
      } else {
        await createLocMutation.mutateAsync({ entityId: detailId, localeId: currentLocale.id, data: dataWithTitle });
      }
    }

    const entityUpdates = adapter.buildEntityUpdates(values, detail);
    if (Object.keys(entityUpdates).length > 0) {
      await updateEntityMutation.mutateAsync({ entityId: detailId, data: entityUpdates });
    }

    reset(values);
    showSuccess(t(`${adapter.i18nNamespace}.messages.saved`));

    // A forked save moved the user's edits onto a new draft version — take
    // them there so subsequent edits continue on the draft, not the original.
    if (target?.redirectPath) {
      navigate(target.redirectPath);
    }
  }, [
    adapter,
    detail,
    currentLocale,
    currentLocalization,
    getValues,
    reset,
    showSuccess,
    t,
    navigate,
    updateEntityMutation,
    updateLocMutation,
    createLocMutation,
  ]);

  // Fire-and-forget save wrapper that never rejects: per-leg errors (e.g. the
  // publish-gate 400 on the entity update) are already surfaced via each
  // mutation's onError. A throw here correctly skips reset()/success, leaving
  // the form dirty so the user can retry — we just must not leak the rejection.
  return useCallback(async () => {
    try {
      await handleSave();
    } catch {
      // already surfaced via mutation onError
    }
  }, [handleSave]);
}
