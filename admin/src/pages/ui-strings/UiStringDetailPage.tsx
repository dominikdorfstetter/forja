import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, TextField } from '@mui/material';

import { PageHeader } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { createUiString, deleteUiString, getUiStringEntries, updateUiString } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { queryKeys } from '@/lib/queryKeys';
import { formResolver } from '@/utils/validation';
import LocaleValuesEditor from './LocaleValuesEditor';
import { orderedActiveLocales } from './localeCoverage';
import {
  UI_STRING_KEY_MAX_LEN,
  buildCreatePayload,
  buildUiStringSchema,
  buildUpdatePayload,
  type UiStringFormData,
} from './uiStringForm';

/**
 * UI string editor (roadmap §1): `/ui-strings/new` creates the key with its
 * default-locale value; `/ui-strings/:id` renames the key and edits values
 * per locale (LocaleAwareFields). Key + default value save through the
 * global save bar; other locales save on blur inside LocaleValuesEditor.
 */
export default function UiStringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEditAll } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: entries, isLoading, error } = useQuery({
    queryKey: queryKeys.uiStrings(siteId),
    queryFn: () => getUiStringEntries(siteId),
    enabled: !!siteId,
  });
  const { data: siteLocales, isLoading: localesLoading } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
    enabled: !!siteId,
  });

  const row = isNew ? undefined : entries?.find((entry) => entry.id === id);
  const locales = useMemo(() => orderedActiveLocales(siteLocales ?? []), [siteLocales]);
  const defaultLocale = locales[0];

  const schema = useMemo(() => buildUiStringSchema(t), [t]);
  const { register, control, handleSubmit, reset, getValues, watch, formState } =
    useForm<UiStringFormData>({
      resolver: formResolver(schema),
      defaultValues: { key: '', value: '' },
      mode: 'onChange',
    });
  const { isDirty, dirtyFields, errors } = formState;

  useEffect(() => {
    if (!row || !defaultLocale) return;
    const defaultLoc = row.localizations.find((l) => l.locale_id === defaultLocale.locale_id);
    reset({ key: row.key, value: defaultLoc?.value ?? '' });
  }, [row?.id, defaultLocale?.locale_id]); // eslint-disable-line react-hooks/exhaustive-deps -- resync only when the entity or default locale changes, not on refetch identity churn

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.uiStrings(siteId) });

  const createMutation = useMutation({
    mutationFn: (values: UiStringFormData) =>
      createUiString(siteId, buildCreatePayload(values, defaultLocale?.locale_id)),
    onSuccess: (created) => {
      invalidate();
      reset(getValues());
      showSuccess(t('uiStrings.detail.created'));
      navigate(`/ui-strings/${created.id}`, { replace: true });
    },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: (values: UiStringFormData) =>
      updateUiString(
        siteId,
        id ?? '',
        buildUpdatePayload(values, { key: !!dirtyFields.key, value: !!dirtyFields.value }, defaultLocale?.locale_id),
      ),
    onSuccess: () => {
      invalidate();
      reset(getValues());
      showSuccess(t('uiStrings.detail.saved'));
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUiString(siteId, id ?? ''),
    onSuccess: () => {
      invalidate();
      showSuccess(t('uiStrings.deleted'));
      navigate('/ui-strings');
    },
    onError: showError,
  });

  useFormSaveBar({
    id: 'ui-string-editor',
    isDirty,
    saving: createMutation.isPending || updateMutation.isPending,
    dirtyFields,
    saveTestId: 'ui-strings.detail.save',
    discardTestId: 'ui-strings.detail.discard',
    onSave: () => {
      void handleSubmit((values) =>
        isNew ? createMutation.mutate(values) : updateMutation.mutate(values),
      )();
    },
    onDiscard: () => reset(),
  });

  if (isLoading || localesLoading || !defaultLocale) {
    return <LoadingState label={t('uiStrings.detail.loading')} />;
  }
  if (error) return <Alert severity="error">{t('uiStrings.list.loadError')}</Alert>;
  if (!isNew && !row) return <Alert severity="warning">{t('uiStrings.detail.notFound')}</Alert>;

  const title = isNew ? t('uiStrings.detail.newTitle') : (row?.key ?? '');

  return (
    <Box data-testid="ui-strings.detail.page">
      <PageHeader
        icon="translate"
        breadcrumb={`${t('layout.sidebar.structure')} / ${t('uiStrings.title')} / ${title}`}
        title={title}
        subtitle={t('uiStrings.detail.subtitle')}
        actions={
          <>
            <M3Button
              variant="text"
              size="md"
              icon="arrow_back"
              onClick={() => navigate('/ui-strings')}
              data-testid="ui-strings.detail.back"
            >
              {t('common.actions.back')}
            </M3Button>
            {!isNew && canEditAll && (
              <M3Button
                variant="outlined"
                size="md"
                icon="delete"
                onClick={() => setDeleteOpen(true)}
                data-testid="ui-strings.detail.delete"
              >
                {t('common.actions.delete')}
              </M3Button>
            )}
          </>
        }
      />

      <Box sx={{ display: 'grid', gap: 2, maxWidth: 720 }}>
        <TextField
          label={t('uiStrings.detail.keyLabel')}
          fullWidth
          required
          disabled={!canEditAll}
          {...register('key')}
          error={!!errors.key}
          helperText={errors.key?.message || t('uiStrings.detail.keyHelp')}
          slotProps={{
            htmlInput: { maxLength: UI_STRING_KEY_MAX_LEN, 'data-testid': 'ui-strings.field.key' },
          }}
        />

        <LocaleValuesEditor
          siteId={siteId}
          locales={locales}
          row={row}
          control={control}
          defaultValue={watch('value')}
          readOnly={!canEditAll}
        />
      </Box>

      <ConfirmDialog
        open={deleteOpen}
        title={t('uiStrings.deleteTitle')}
        message={t('uiStrings.deleteConfirm', { key: row?.key ?? '' })}
        confirmLabel={t('common.actions.delete')}
        confirmColor="error"
        onConfirm={() => {
          setDeleteOpen(false);
          deleteMutation.mutate();
        }}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
