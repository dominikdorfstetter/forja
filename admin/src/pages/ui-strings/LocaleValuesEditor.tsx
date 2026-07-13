import { useState } from 'react';
import { Box, Chip, Tab, Tabs, TextField, Typography } from '@mui/material';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import LocaleAwareFields from '@/components/locale-aware/LocaleAwareFields';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { updateUiString } from '@/services/uiStrings';
import { queryKeys } from '@/lib/queryKeys';
import type { SiteLocaleResponse, UiStringResponse } from '@/types/api';
import { localeValueState } from './localeCoverage';
import { UI_STRING_VALUE_MAX_LEN, type UiStringFormData } from './uiStringForm';

interface LocaleValuesEditorProps {
  siteId: string;
  /** Ordered active site locales, default locale first. */
  locales: SiteLocaleResponse[];
  /** The persisted string — absent while creating (only the default locale is editable then). */
  row?: UiStringResponse;
  control: Control<UiStringFormData>;
  /** Default-locale value, used as placeholder on non-default locales. */
  defaultValue: string;
  readOnly: boolean;
  /** Live non-default edits, so the page can batch them into the save-bar
   *  PUT (the backend exempts payload locales from the outdated flip). */
  onLocaleValueEdited?: (localeId: string, value: string) => void;
}

function TabStateChip({ state }: { state: 'missing' | 'outdated' }) {
  const { t } = useTranslation();
  return (
    <Chip
      label={t(`uiStrings.detail.status.${state}`)}
      size="small"
      color={state === 'outdated' ? 'warning' : 'default'}
      variant="outlined"
      sx={{ height: 20, fontSize: '0.65rem' }}
    />
  );
}

function ReadOnlyValues({ locales, row }: { locales: SiteLocaleResponse[]; row?: UiStringResponse }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {locales.map((locale) => {
        const loc = row?.localizations.find((l) => l.locale_id === locale.locale_id);
        return (
          <TextField
            key={locale.locale_id}
            label={t('uiStrings.detail.valueForLocale', { locale: locale.code.toUpperCase() })}
            value={loc?.value ?? ''}
            fullWidth
            multiline
            disabled
            slotProps={{
              htmlInput: { 'data-testid': `ui-strings.readonly.${locale.code}` },
            }}
          />
        );
      })}
    </Box>
  );
}

/**
 * Per-locale value editing for one UI string, following the house
 * LocaleAwareFields split: the default locale binds to the form and saves
 * with the save bar; every other locale saves on blur through the PUT
 * upsert (`localizations: [{locale_id, value}]`). Empty non-default values
 * are not sent — the API cannot clear a localization, only upsert it.
 */
export default function LocaleValuesEditor({
  siteId,
  locales,
  row,
  control,
  defaultValue,
  readOnly,
  onLocaleValueEdited,
}: LocaleValuesEditorProps) {
  const { t } = useTranslation();
  const { showError } = useErrorSnackbar();
  const [activeTab, setActiveTab] = useState(0);

  if (readOnly) return <ReadOnlyValues locales={locales} row={row} />;

  const editableLocales = row ? locales : locales.slice(0, 1);
  const currentLocale = editableLocales[Math.min(activeTab, editableLocales.length - 1)];
  if (!currentLocale) return null;

  const isDefaultLocale = currentLocale === editableLocales[0];
  const currentLoc = row?.localizations.find((l) => l.locale_id === currentLocale.locale_id);

  const saveLocaleValue = (values: Record<string, string>) => {
    const value = values.value ?? '';
    if (!row || value.trim().length === 0) return Promise.resolve();
    // An unchanged blur is a no-op — unless the row is flagged outdated,
    // where an explicit re-save is the confirm that clears the flag.
    if (value === currentLoc?.value && currentLoc.translation_status !== 'Outdated') {
      return Promise.resolve();
    }
    return updateUiString(siteId, row.id, {
      localizations: [{ locale_id: currentLocale.locale_id, value }],
    }).catch((error) => {
      showError(error);
      throw error;
    });
  };

  return (
    <Box>
      {editableLocales.length > 1 && (
        <Tabs
          value={Math.min(activeTab, editableLocales.length - 1)}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
          data-testid="ui-strings.locale-tabs"
        >
          {editableLocales.map((locale) => {
            const state = row ? localeValueState(row, locale.locale_id) : 'missing';
            return (
              <Tab
                key={locale.locale_id}
                data-testid={`ui-strings.tab.${locale.code}`}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {locale.code.toUpperCase()}
                    {state !== 'translated' && <TabStateChip state={state} />}
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      )}

      <LocaleAwareFields<UiStringFormData>
        key={currentLocale.locale_id}
        fields={[
          {
            name: 'value',
            label: t('uiStrings.detail.valueLabel'),
            maxLength: UI_STRING_VALUE_MAX_LEN,
            counterMax: UI_STRING_VALUE_MAX_LEN,
            multiline: true,
            rows: 3,
            testId: 'ui-strings.field.value',
          },
        ]}
        control={control}
        isDefault={isDefaultLocale}
        onDefaultBlur={() => {}}
        locale={{ id: currentLocale.locale_id, code: currentLocale.code }}
        localization={currentLoc ? { id: currentLoc.id, value: currentLoc.value } : undefined}
        createLocalization={(_localeId, values) => saveLocaleValue(values)}
        updateLocalization={(_locId, values) => saveLocaleValue(values)}
        onLocaleValuesChange={(values) =>
          onLocaleValueEdited?.(currentLocale.locale_id, values.value ?? '')
        }
        invalidateKey={queryKeys.uiStrings(siteId)}
        placeholders={{ value: defaultValue }}
        localeHint={
          isDefaultLocale
            ? undefined
            : t('uiStrings.detail.localeHint', { locale: currentLocale.code.toUpperCase() })
        }
      />

      {!row && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('uiStrings.detail.createHint')}
        </Typography>
      )}
    </Box>
  );
}
