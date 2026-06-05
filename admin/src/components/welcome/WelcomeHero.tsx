import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/clerk-react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import GradientHeading from './primitives/GradientHeading';
import Eyebrow from './primitives/Eyebrow';
import { appConfig } from '@/appConfig';

interface WelcomeHeroProps {
  onTryDemo: () => void;
  demoLoading: boolean;
}

const SOCIAL_BADGES = ['rust', 'react', 'postgresql', 'typescript', 'gdpr'] as const;
const GITHUB_URL = 'https://github.com/dominikdorfstetter/forja';

const focusRing = {
  '&:focus-visible': {
    outline: '2px solid var(--w-ring)',
    outlineOffset: '2px',
  },
};

/**
 * Hero (#809): wedge-first gradient h1 anchored on compliance-by-construction,
 * a clear CTA hierarchy (primary sign-up, demo only in demo mode, self-host),
 * and an ambient radial glow. Token-driven, so it themes with the OS and the
 * glow is neutralised under prefers-reduced-motion by the surface token block.
 */
export default function WelcomeHero({ onTryDemo, demoLoading }: WelcomeHeroProps) {
  const { t } = useTranslation();
  const clerk = useClerk();

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        px: { xs: 3, md: 6 },
        pt: { xs: 14, md: 20 },
        pb: { xs: 8, md: 12 },
        // Matches the sections' Container maxWidth="lg" so every left edge aligns.
        maxWidth: 1200,
        mx: 'auto',
      }}
    >
      {/* Ambient radial glow — animation disabled under reduced motion */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'var(--w-glow)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'welcomeGlow 8s ease-in-out infinite',
          '@keyframes welcomeGlow': {
            '0%, 100%': { opacity: 0.7 },
            '50%': { opacity: 1 },
          },
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: '46rem' }}>
        <Eyebrow sx={{ mb: 3 }}>{t('welcome.hero.eyebrow')}</Eyebrow>

        <GradientHeading component="h1" fontSize="var(--w-text-6xl)" sx={{ mb: 3 }}>
          {t('welcome.hero.headline')}
        </GradientHeading>

        <Typography
          sx={{
            fontSize: 'var(--w-text-xl)',
            lineHeight: 'var(--w-leading-base)',
            color: 'var(--w-fg-muted)',
            maxWidth: '40rem',
            mb: 5,
          }}
        >
          {t('welcome.hero.subline')}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 6 }}>
          <Button
            data-testid="welcome.hero.cta.signup"
            onClick={() =>
              clerk.redirectToSignUp({ signInFallbackRedirectUrl: '/dashboard' })
            }
            disableElevation
            sx={{
              px: 3.5,
              py: 1.5,
              fontSize: 'var(--w-text-base)',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 'var(--w-radius-lg)',
              backgroundColor: 'var(--w-primary)',
              color: 'var(--w-primary-fg)',
              '&:hover': { backgroundColor: 'var(--w-primary-hover)' },
              ...focusRing,
            }}
          >
            {t('welcome.hero.ctaSignup')}
          </Button>

          {appConfig.demoMode && (
            <Button
              data-testid="welcome.hero.cta.demo"
              onClick={onTryDemo}
              disabled={demoLoading}
              variant="outlined"
              sx={{
                px: 3.5,
                py: 1.5,
                fontSize: 'var(--w-text-base)',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 'var(--w-radius-lg)',
                borderColor: 'var(--w-border-strong)',
                color: 'var(--w-fg)',
                '&:hover': { borderColor: 'var(--w-primary)', backgroundColor: 'var(--w-primary-soft)' },
                ...focusRing,
              }}
            >
              {demoLoading && (
                <CircularProgress size={16} sx={{ color: 'var(--w-fg)', mr: 1 }} />
              )}
              {t('welcome.hero.ctaDemo')}
            </Button>
          )}

          <Button
            data-testid="welcome.hero.cta.selfhost"
            component="a"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener"
            variant="text"
            sx={{
              px: 3,
              py: 1.5,
              fontSize: 'var(--w-text-base)',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 'var(--w-radius-lg)',
              color: 'var(--w-fg-muted)',
              '&:hover': { color: 'var(--w-fg)', backgroundColor: 'var(--w-bg-elevated)' },
              ...focusRing,
            }}
          >
            {t('welcome.hero.ctaSelfHost')} →
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {SOCIAL_BADGES.map((key) => (
            <Box
              key={key}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: 'var(--w-radius-full)',
                border: '1px solid var(--w-border)',
                backgroundColor: 'var(--w-bg-elevated)',
              }}
            >
              <Box
                aria-hidden
                sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--w-primary)' }}
              />
              <Typography sx={{ fontSize: 'var(--w-text-xs)', fontWeight: 500, color: 'var(--w-fg-subtle)' }}>
                {t(`welcome.socialProof.${key}`)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
