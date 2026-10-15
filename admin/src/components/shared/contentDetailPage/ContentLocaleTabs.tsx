import type { ReactNode, SyntheticEvent } from 'react';
import { Trans } from 'react-i18next';
import { Alert, Box, Chip, Tab, Tabs } from '@mui/material';
import { pageTabsSx } from '@/components/shared/listPageV2';
import type { ActiveLocale } from './types';

interface ContentLocaleTabsProps {
  activeLocales: readonly ActiveLocale[];
  activeTab: number;
  onTabChange: (event: SyntheticEvent, index: number) => void;
  /** Whether the entity already has a localization for the locale. */
  hasLocalization: (localeId: string) => boolean;
  /** i18n key of the "no active locales" hint (rendered with `<strong>`). */
  noLocalesKey: string;
  /** The editor for the active locale. */
  children: ReactNode;
}

/** Multi-locale editors: one tab per active site locale above the editor. */
export function ContentLocaleTabs({
  activeLocales,
  activeTab,
  onTabChange,
  hasLocalization,
  noLocalesKey,
  children,
}: ContentLocaleTabsProps) {
  if (activeLocales.length === 0) {
    return (
      <Alert severity="info">
        <Trans i18nKey={noLocalesKey} components={{ strong: <strong /> }} />
      </Alert>
    );
  }
  return (
    <>
      <Tabs value={activeTab} onChange={onTabChange} sx={pageTabsSx} variant="scrollable" scrollButtons="auto">
        {activeLocales.map((locale) => (
          <Tab
            key={locale.id}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {locale.code.toUpperCase()}
                {hasLocalization(locale.id) && (
                  <Chip
                    label="exists"
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            }
          />
        ))}
      </Tabs>
      {children}
    </>
  );
}
