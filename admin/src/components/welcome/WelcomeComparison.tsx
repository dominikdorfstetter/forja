import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SectionHeader from './primitives/SectionHeader';
import WelcomeSection from './primitives/WelcomeSection';

/** Paired rows: legacy CMS pain on the left, the Forja answer on the right. */
const ROWS: { traditional: string; forja: string }[] = [
  { traditional: 'monolithic', forja: 'headless' },
  { traditional: 'plugins', forja: 'builtIn' },
  { traditional: 'sharedHosting', forja: 'selfHosted' },
  { traditional: 'legacy', forja: 'fast' },
];

/** Traditional CMS vs Forja (#810) — restyled with the brand tokens. */
export default function WelcomeComparison() {
  const { t } = useTranslation();
  const headingId = 'welcome-comparison-heading';

  return (
    <WelcomeSection labelledBy={headingId} maxWidth="lg" data-testid="welcome.section.comparison">
      <SectionHeader
        id={headingId}
        eyebrow={t('welcome.comparison.eyebrow')}
        title={t('welcome.whyForja')}
        lead={t('welcome.comparison.lead')}
      />

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 4 },
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        {(['traditional', 'forja'] as const).map((side) => {
          const isForja = side === 'forja';
          return (
            <Stack
              key={side}
              spacing={2}
              data-testid={`welcome.comparison.${side}`}
              sx={{
                p: 3,
                borderRadius: 'var(--w-radius-xl)',
                backgroundColor: 'var(--w-bg-elevated)',
                border: `1px solid ${isForja ? 'var(--w-primary)' : 'var(--w-border)'}`,
              }}
            >
              <Typography
                component="h3"
                sx={{
                  fontFamily: 'var(--w-font-display)',
                  fontSize: 'var(--w-text-xl)',
                  fontWeight: 700,
                  fontVariationSettings: 'normal',
                  color: isForja ? 'var(--w-primary)' : 'var(--w-fg-muted)',
                }}
              >
                {t(`welcome.comparison.${side}`)}
              </Typography>
              {ROWS.map((row) => (
                <Stack key={row[side]} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  {isForja ? (
                    <CheckRoundedIcon aria-hidden sx={{ fontSize: 20, color: 'var(--w-primary)', flexShrink: 0 }} />
                  ) : (
                    <CloseRoundedIcon aria-hidden sx={{ fontSize: 20, color: 'var(--w-fg-subtle)', flexShrink: 0 }} />
                  )}
                  <Typography sx={{ fontSize: 'var(--w-text-base)', color: 'var(--w-fg-muted)' }}>
                    {t(`welcome.comparison.${row[side]}`)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          );
        })}
      </Box>
    </WelcomeSection>
  );
}
