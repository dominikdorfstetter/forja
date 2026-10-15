import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import type { UiStringResponse } from '@/types/api';
import {
  buildUiStringKeySchema,
  persistedLocaleValues,
  type LocaleValueDraft,
  type UiStringKeyFormData,
} from './uiStringForm';

/**
 * Form state of the UI-string dialog: the key rides in RHF, per-locale values
 * live in a draft map (plus which locales the user touched) behind locale
 * tabs. Everything resets to the persisted row each time the dialog opens.
 */
export function useUiStringDialogForm(open: boolean, row: UiStringResponse | null | undefined) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildUiStringKeySchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, dirtyFields },
  } = useForm<UiStringKeyFormData>({
    resolver: formResolver(schema),
    defaultValues: { key: '' },
    mode: 'onChange',
  });

  const [draft, setDraft] = useState<LocaleValueDraft>({});
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [activeTab, setActiveTab] = useState(0);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({ key: row?.key ?? '' });
      setDraft(persistedLocaleValues(row));
      setTouched(new Set());
      setActiveTab(0);
    }
    prevOpenRef.current = open;
  }, [open, row, reset]);

  const setLocaleValue = (localeId: string, value: string) => {
    setDraft((prev) => ({ ...prev, [localeId]: value }));
    setTouched((prev) => (prev.has(localeId) ? prev : new Set(prev).add(localeId)));
  };

  return {
    register,
    handleSubmit,
    errors,
    isValid,
    keyDirty: !!dirtyFields.key,
    draft,
    touched,
    activeTab,
    setActiveTab,
    setLocaleValue,
  };
}
