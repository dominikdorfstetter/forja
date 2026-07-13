import { Box, Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { SiteLocaleResponse, UiStringResponse } from '@/types/api';
import { localeValueState } from './localeCoverage';

/**
 * Per-locale completeness cell: one chip per active site locale showing at
 * a glance whether the key is translated, outdated, or missing there.
 */
export default function LocaleCoverageChips({
  row,
  locales,
}: {
  row: UiStringResponse;
  locales: SiteLocaleResponse[];
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {locales.map((locale) => {
        const state = localeValueState(row, locale.locale_id);
        return (
          <Tooltip
            key={locale.locale_id}
            title={t(`uiStrings.list.localeStatus.${state}`, {
              locale: locale.code.toUpperCase(),
            })}
          >
            <Chip
              label={locale.code.toUpperCase()}
              size="small"
              data-testid={`ui-strings.chip.${row.key}.${locale.code}.${state}`}
              color={state === 'outdated' ? 'warning' : state === 'translated' ? 'success' : 'default'}
              variant={state === 'outdated' ? 'filled' : 'outlined'}
              sx={state === 'missing' ? { borderStyle: 'dashed', color: 'text.disabled' } : undefined}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
