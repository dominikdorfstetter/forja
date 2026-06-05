import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Box, CircularProgress, Link, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GradientHeading from './primitives/GradientHeading';
import WelcomeSurface from './theme/WelcomeSurface';
import { useImprint } from '@/hooks/useImprint';
import type { ImprintResponse } from '@/types/api';

/** Operator fields, in display order, paired with their i18n label key. */
const FIELDS: { key: keyof ImprintResponse; label: string }[] = [
  { key: 'operator_name', label: 'imprint.operatorName' },
  { key: 'address', label: 'imprint.address' },
  { key: 'email', label: 'imprint.email' },
  { key: 'phone', label: 'imprint.phone' },
  { key: 'vat', label: 'imprint.vat' },
  { key: 'register', label: 'imprint.register' },
  { key: 'responsible', label: 'imprint.responsible' },
];

/**
 * Imprint (Impressum) page rendered inside the signed-out Welcome surface
 * (#812). Operator values are rendered verbatim as text — never as HTML.
 */
export default function WelcomeImprint() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useImprint();

  return (
    <WelcomeSurface aria-label={t('imprint.title')}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 3, md: 6 }, py: { xs: 10, md: 16 } }}>
        <Link
          component={RouterLink}
          to="/"
          data-testid="imprint.back"
          underline="none"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 4,
            fontSize: 'var(--w-text-sm)',
            color: 'var(--w-fg-muted)',
            '&:hover': { color: 'var(--w-fg)' },
          }}
        >
          <ArrowBackRoundedIcon aria-hidden sx={{ fontSize: 18 }} />
          {t('imprint.back')}
        </Link>

        <GradientHeading component="h1" fontSize="var(--w-text-5xl)" sx={{ mb: 5 }}>
          {t('imprint.title')}
        </GradientHeading>

        {isLoading && (
          <CircularProgress data-testid="imprint.loading" sx={{ color: 'var(--w-primary)' }} />
        )}

        {isError && (
          <Typography data-testid="imprint.error" sx={{ color: 'var(--w-fg-muted)' }}>
            {t('imprint.loadError')}
          </Typography>
        )}

        {!isLoading && !isError && !data?.configured && (
          <Typography data-testid="imprint.unconfigured" sx={{ color: 'var(--w-fg-muted)' }}>
            {t('imprint.unconfigured')}
          </Typography>
        )}

        {data?.configured && (
          <Stack spacing={3} data-testid="imprint.details">
            {FIELDS.filter(({ key }) => Boolean(data[key])).map(({ key, label }) => (
              <Box key={key}>
                <Typography
                  sx={{
                    fontSize: 'var(--w-text-sm)',
                    fontWeight: 600,
                    letterSpacing: 'var(--w-tracking-wide)',
                    textTransform: 'uppercase',
                    color: 'var(--w-fg-subtle)',
                    mb: 0.5,
                  }}
                >
                  {t(label)}
                </Typography>
                {/* value is operator text — React escapes it; never HTML */}
                <Typography sx={{ fontSize: 'var(--w-text-lg)', color: 'var(--w-fg)', whiteSpace: 'pre-line' }}>
                  {data[key]}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </WelcomeSurface>
  );
}
