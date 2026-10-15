import { Box, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import type {
  CreateUiStringRequest,
  SiteLocaleResponse,
  UiStringResponse,
  UpdateUiStringRequest,
} from '@/types/api';
import {
  UI_STRING_KEY_MAX_LEN,
  buildCreatePayload,
  buildUpdatePayload,
  computeUpdateDelta,
  defaultValueMissing,
  isSubmitBlocked,
  localeValueFieldState,
  type UiStringKeyFormData,
} from './uiStringForm';
import { useUiStringDialogForm } from './useUiStringDialogForm';
import { UiStringLocaleTabs, UiStringValueField } from './UiStringLocaleFields';

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
  const form = useUiStringDialogForm(open, row);
  const { draft, touched } = form;

  const tabIndex = Math.min(form.activeTab, locales.length - 1);
  const defaultLocale = locales[0];
  const currentLocale = locales[tabIndex];
  if (!defaultLocale || !currentLocale) return null;

  const delta = row ? computeUpdateDelta(row, draft, touched, locales) : undefined;
  const submitDisabled = isSubmitBlocked({
    isValid: form.isValid,
    keyDirty: form.keyDirty,
    defaultMissing: defaultValueMissing(draft, defaultLocale.locale_id),
    delta,
  });

  const onFormSubmit = ({ key }: UiStringKeyFormData) => {
    if (delta) onSubmitUpdate?.(buildUpdatePayload(key, form.keyDirty, delta));
    else onSubmitCreate?.(buildCreatePayload(key, draft, locales));
  };

  const isDefault = currentLocale.locale_id === defaultLocale.locale_id;
  const valueField = localeValueFieldState(row, draft, touched, currentLocale.locale_id, isDefault);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={readOnly ? undefined : form.handleSubmit(onFormSubmit)}
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
        {...form.register('key')}
        error={!!form.errors.key}
        helperText={form.errors.key?.message || t('uiStrings.dialog.keyHelp')}
        slotProps={{
          htmlInput: { maxLength: UI_STRING_KEY_MAX_LEN, 'data-testid': 'ui-strings.field.key' },
        }}
      />

      <Box>
        <UiStringLocaleTabs
          locales={locales}
          row={row}
          value={tabIndex}
          onChange={form.setActiveTab}
        />
        <UiStringValueField
          key={currentLocale.locale_id}
          locale={currentLocale}
          field={valueField}
          isDefault={isDefault}
          readOnly={readOnly}
          onChange={(value) => form.setLocaleValue(currentLocale.locale_id, value)}
        />
      </Box>
    </FormDialog>
  );
}
