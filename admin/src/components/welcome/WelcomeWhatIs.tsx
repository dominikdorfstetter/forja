import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SectionHeader from './primitives/SectionHeader';
import WelcomeSection from './primitives/WelcomeSection';

const POINT_KEYS = ['point1', 'point2', 'point3'] as const;

/**
 * Lead explainer (#808): tells a reader who does not know what a CMS is what
 * Forja does, in plain language. Sits above the hero proof points; the first
 * paragraph is deliberately jargon-free (no "CMS"/"headless"/"API"/"backend").
 */
export default function WelcomeWhatIs() {
  const { t } = useTranslation();
  const headingId = 'welcome-whatis-heading';

  return (
    <WelcomeSection labelledBy={headingId} data-testid="welcome.section.whatis">
      <SectionHeader
        id={headingId}
        eyebrow={t('welcome.whatIs.eyebrow')}
        title={t('welcome.whatIs.heading')}
        lead={t('welcome.whatIs.lead')}
        data-lead-testid="welcome.whatis.lead"
      />

      <Stack spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: '60ch' }}>
        {POINT_KEYS.map((key) => (
          <Box
            key={key}
            component="li"
            data-testid={`welcome.whatis.${key}`}
            sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
          >
            <CheckCircleRoundedIcon
              aria-hidden
              sx={{ fontSize: 22, color: 'var(--w-primary)', flexShrink: 0, mt: '2px' }}
            />
            <Typography sx={{ fontSize: 'var(--w-text-lg)', color: 'var(--w-fg-muted)' }}>
              {t(`welcome.whatIs.${key}`)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </WelcomeSection>
  );
}
