import { Box, Chip, Tab, Tabs, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SiteLocaleResponse, UiStringResponse } from '@/types/api';
import { localeValueState, type LocaleValueState } from './localeCoverage';
import { UI_STRING_VALUE_MAX_LEN, type LocaleValueFieldState } from './uiStringForm';

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

function LocaleTabLabel({ locale, row }: { locale: SiteLocaleResponse; row?: UiStringResponse | null }) {
  const state = row ? localeValueState(row, locale.locale_id) : undefined;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {locale.code.toUpperCase()}
      {state && state !== 'translated' && <TabStatusChip code={locale.code} state={state} />}
    </Box>
  );
}

/** One tab per locale, flagging outdated/missing values in edit mode; hidden for single-locale sites. */
export function UiStringLocaleTabs({
  locales,
  row,
  value,
  onChange,
}: {
  locales: SiteLocaleResponse[];
  row?: UiStringResponse | null;
  value: number;
  onChange: (index: number) => void;
}) {
  if (locales.length <= 1) return null;
  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v)}
      variant="scrollable"
      scrollButtons="auto"
      sx={{ mb: 1 }}
      data-testid="ui-strings.locale-tabs"
    >
      {locales.map((locale) => (
        <Tab
          key={locale.locale_id}
          data-testid={`ui-strings.tab.${locale.code}`}
          label={<LocaleTabLabel locale={locale} row={row} />}
        />
      ))}
    </Tabs>
  );
}

/** Value input of the active locale; the default locale's value is required. */
export function UiStringValueField({
  locale,
  field,
  isDefault,
  readOnly,
  onChange,
}: {
  locale: SiteLocaleResponse;
  field: LocaleValueFieldState;
  isDefault: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const helperText = field.showRequiredError
    ? t('uiStrings.dialog.valueRequired')
    : field.cleared
      ? t('uiStrings.dialog.clearHint')
      : undefined;

  return (
    <TextField
      label={t('uiStrings.dialog.valueForLocale', { locale: locale.code.toUpperCase() })}
      fullWidth
      multiline
      rows={3}
      required={isDefault}
      disabled={readOnly}
      value={field.value}
      onChange={(e) => onChange(e.target.value)}
      error={field.showRequiredError}
      helperText={helperText}
      slotProps={{
        htmlInput: {
          maxLength: UI_STRING_VALUE_MAX_LEN,
          'data-testid': 'ui-strings.dialog.value',
        },
      }}
    />
  );
}
