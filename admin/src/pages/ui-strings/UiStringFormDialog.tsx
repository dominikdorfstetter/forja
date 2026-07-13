import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Tab, Tabs, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { formResolver } from '@/utils/validation';
import type {
  CreateUiStringRequest,
  SiteLocaleResponse,
  UiStringResponse,
  UpdateUiStringRequest,
} from '@/types/api';
import { localeValueState, type LocaleValueState } from './localeCoverage';
import {
  UI_STRING_KEY_MAX_LEN,
  UI_STRING_VALUE_MAX_LEN,
  buildCreatePayload,
  buildUiStringKeySchema,
  buildUpdatePayload,
  computeUpdateDelta,
  deltaHasChanges,
  persistedLocaleValues,
  type LocaleValueDraft,
  type UiStringKeyFormData,
} from './uiStringForm';

interface UiStringFormDialogProps {
  open: boolean;
  /** Persisted string to edit — omit to create. */
  row?: UiStringResponse | null;
  /** Ordered active site locales, default locale first. */
  locales: SiteLocaleResponse[];
  /** Viewers get a read-only look at all values instead of an editor. */
  readOnly?: boolean;
  loading?: boolean;
  onSubmitCreate?: (payload: CreateUiStringRequest) => void;
  onSubmitUpdate?: (payload: UpdateUiStringRequest) => void;
  onClose: () => void;
}

function TabStatusChip({ code, state }: { code: string; state: Exclude<LocaleValueState, 'translated'> }) {
  const { t } = useTranslation();
  return (
    <Chip
      label={t(`uiStrings.dialog.status.${state}`)}
      size="small"
      color={state === 'outdated' ? 'warning' : 'default'}
      variant="outlined"
      data-testid={`ui-strings.dialog.status.${code}.${state}`}
      sx={{ height: 20, fontSize: '0.65rem' }}
    />
  );
}

/**
 * Create/edit dialog for one UI string (house FormDialog + MenuFormDialog
 * pattern): the key rides in RHF, per-locale values live in a draft map
 * behind locale tabs. Everything saves in ONE request — create POSTs the key
 * with every filled locale; edit PUTs only the values that actually changed
 * (plus outdated values the user explicitly touched to confirm), and cleared
 * previously-persisted non-default values ride in `removed_locale_ids`.
 * Clearing the default value blocks the save — it drives the fallback chain.
 */
export default function UiStringFormDialog({
  open,
  row,
  locales,
  readOnly = false,
  loading,
  onSubmitCreate,
  onSubmitUpdate,
  onClose,
}: UiStringFormDialogProps) {
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

  const defaultLocale = locales[0];
  const currentLocale = locales[Math.min(activeTab, locales.length - 1)];
  if (!defaultLocale || !currentLocale) return null;

  const setLocaleValue = (localeId: string, value: string) => {
    setDraft((prev) => ({ ...prev, [localeId]: value }));
    setTouched((prev) => (prev.has(localeId) ? prev : new Set(prev).add(localeId)));
  };

  const defaultValueEmpty = (draft[defaultLocale.locale_id] ?? '').trim().length === 0;
  const keyDirty = !!dirtyFields.key;
  const delta = row ? computeUpdateDelta(row, draft, touched, locales) : undefined;
  const submitDisabled =
    !isValid || defaultValueEmpty || (delta ? !keyDirty && !deltaHasChanges(delta) : false);

  const onFormSubmit = ({ key }: UiStringKeyFormData) => {
    if (delta) onSubmitUpdate?.(buildUpdatePayload(key, keyDirty, delta));
    else onSubmitCreate?.(buildCreatePayload(key, draft, locales));
  };

  const isDefault = currentLocale.locale_id === defaultLocale.locale_id;
  const currentValue = draft[currentLocale.locale_id] ?? '';
  const currentPersisted = row?.localizations.find(
    (l) => l.locale_id === currentLocale.locale_id,
  );
  const currentCleared =
    !!currentPersisted && currentPersisted.value.length > 0 && currentValue.trim().length === 0;
  const showDefaultError =
    isDefault && defaultValueEmpty && (!!row || touched.has(currentLocale.locale_id));

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={readOnly ? undefined : handleSubmit(onFormSubmit)}
      icon="translate"
      title={row ? t('uiStrings.dialog.editTitle') : t('uiStrings.dialog.createTitle')}
      submitLabel={row ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={submitDisabled}
      submitTestId="ui-strings.dialog.submit"
      cancelTestId="ui-strings.dialog.cancel"
      loading={loading}
      actions={
        readOnly ? (
          <M3Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="ui-strings.dialog.close"
          >
            {t('common.actions.close')}
          </M3Button>
        ) : undefined
      }
      data-testid="ui-strings.dialog"
    >
      <TextField
        autoFocus={!row}
        label={t('uiStrings.dialog.keyLabel')}
        fullWidth
        required
        size="small"
        disabled={readOnly}
        {...register('key')}
        error={!!errors.key}
        helperText={errors.key?.message || t('uiStrings.dialog.keyHelp')}
        slotProps={{
          htmlInput: { maxLength: UI_STRING_KEY_MAX_LEN, 'data-testid': 'ui-strings.field.key' },
        }}
      />

      <Box>
        {locales.length > 1 && (
          <Tabs
            value={Math.min(activeTab, locales.length - 1)}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 1 }}
            data-testid="ui-strings.locale-tabs"
          >
            {locales.map((locale) => {
              const state = row ? localeValueState(row, locale.locale_id) : undefined;
              return (
                <Tab
                  key={locale.locale_id}
                  data-testid={`ui-strings.tab.${locale.code}`}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {locale.code.toUpperCase()}
                      {state && state !== 'translated' && (
                        <TabStatusChip code={locale.code} state={state} />
                      )}
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
        )}
        <TextField
          key={currentLocale.locale_id}
          label={t('uiStrings.dialog.valueForLocale', {
            locale: currentLocale.code.toUpperCase(),
          })}
          fullWidth
          multiline
          rows={3}
          required={isDefault}
          disabled={readOnly}
          value={currentValue}
          onChange={(e) => setLocaleValue(currentLocale.locale_id, e.target.value)}
          error={showDefaultError}
          helperText={
            showDefaultError
              ? t('uiStrings.dialog.valueRequired')
              : currentCleared
                ? t('uiStrings.dialog.clearHint')
                : undefined
          }
          slotProps={{
            htmlInput: {
              maxLength: UI_STRING_VALUE_MAX_LEN,
              'data-testid': 'ui-strings.dialog.value',
            },
          }}
        />
      </Box>
    </FormDialog>
  );
}
