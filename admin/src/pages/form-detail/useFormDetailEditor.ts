import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getForm, updateForm } from '@/services/forms';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { FormFieldInput, FormLocalizationInput, UpdateFormRequest } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  draftFromForm,
  isDraftDirty,
  savePayload,
  type FormDraft,
  type SettingsState,
} from './formDetailModel';

/**
 * Server-backed draft for the form detail page: loads the form, keeps an
 * editable draft next to the last-saved snapshot, and exposes the dirty /
 * save / discard trio the page wires into `useFormSaveBar`.
 */
export function useFormDetailEditor(formId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();

  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [original, setOriginal] = useState<FormDraft | null>(null);

  const { data: form, isLoading } = useQuery({
    queryKey: queryKeys.form(formId),
    queryFn: () => getForm(formId),
    enabled: !!formId,
  });

  // Seed local state on first load + when server data changes.
  useEffect(() => {
    if (form) {
      const snap = draftFromForm(form);
      setDraft(snap);
      setOriginal(snap);
    }
  }, [form]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateFormRequest) => updateForm(formId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.form(formId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.forms(selectedSiteId) });
      const snap = draftFromForm(updated);
      setDraft(snap);
      setOriginal(snap);
      showSuccess(t('formsModule.detail.messages.saved', 'Form saved.'));
    },
    onError: showError,
  });

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
    setDraft((d) => (d ? { ...d, settings: { ...d.settings, [key]: value } } : d));

  const setFields = (fields: FormFieldInput[]) =>
    setDraft((d) => (d ? { ...d, fields } : d));

  const setLocalizations = (localizations: FormLocalizationInput[]) =>
    setDraft((d) => (d ? { ...d, localizations } : d));

  const save = () => {
    if (!draft || !original) return;
    const payload = savePayload(draft, original);
    if (Object.keys(payload).length > 0) updateMutation.mutate(payload);
  };

  const discard = () => {
    if (original) setDraft(original);
  };

  return {
    form,
    isLoading,
    draft,
    isDirty: isDraftDirty(draft, original),
    saving: updateMutation.isPending,
    save,
    discard,
    updateSetting,
    setFields,
    setLocalizations,
  };
}
