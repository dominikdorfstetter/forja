import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box, Button, Container, Stack, Typography, useMediaQuery } from '@mui/material';
import WelcomeFeatureGrid from '@/components/welcome/WelcomeFeatureGrid';
import WelcomeLanguageSelector from '@/components/welcome/WelcomeLanguageSelector';
import WelcomeFooter from '@/components/welcome/WelcomeFooter';

export default function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const isSmall = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap';
    document.head.appendChild(link);

    const timer = setTimeout(() => setMounted(true), 50);
    return () => {
      clearTimeout(timer);
      document.head.removeChild(link);
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at 20% 0%, #1a3a6e 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, #162d54 0%, transparent 50%), #0b1929',
        color: '#e8edf4',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Grid pattern overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          pointerEvents: 'none',
        }}
      />

      {/* Glow orb behind logo */}
      <Box
        sx={{
          position: 'absolute',
          top: isSmall ? '10%' : '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,102,245,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          animation: 'welcomePulse 6s ease-in-out infinite',
          '@keyframes welcomePulse': {
            '0%, 100%': { opacity: 0.6, transform: 'translateX(-50%) scale(1)' },
            '50%': { opacity: 1, transform: 'translateX(-50%) scale(1.1)' },
          },
        }}
      />

      <WelcomeLanguageSelector mounted={mounted} />

      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
          py: 8,
          px: 3,
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
            mb: 3,
          }}
        >
          <Box
            component="img"
            src={`${import.meta.env.BASE_URL}icons/forja-icon.svg`}
            alt="Forja"
            sx={{
              width: isSmall ? 80 : 96,
              height: isSmall ? 80 : 96,
              filter: 'drop-shadow(0 0 24px rgba(30,102,245,0.4))',
            }}
          />
        </Box>

        {/* App name */}
        <Typography
          sx={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: isSmall ? '2.5rem' : '3.5rem',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'white',
            mb: 1.5,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
          }}
        >
          Forja
        </Typography>

        {/* Tagline */}
        <Typography
          sx={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: isSmall ? '1.15rem' : '1.4rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.6)',
            mb: 2,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          }}
        >
          {t('welcome.tagline')}
        </Typography>

        {/* Accent divider */}
        <Box
          sx={{
            width: 48,
            height: 2,
            bgcolor: '#1e66f5',
            borderRadius: 1,
            mb: 3,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.8s ease 0.4s',
          }}
        />

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: isSmall ? '0.95rem' : '1.05rem',
            color: 'rgba(255,255,255,0.5)',
            maxWidth: 480,
            textAlign: 'center',
            lineHeight: 1.7,
            mb: 5,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.45s',
          }}
        >
          {t('welcome.subtitle')}
        </Typography>

        <WelcomeFeatureGrid mounted={mounted} isSmall={isSmall} />

        {/* CTA buttons */}
        <Stack
          direction={isSmall ? 'column' : 'row'}
          spacing={2}
          sx={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.9s',
            width: isSmall ? '100%' : 'auto',
          }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              px: 5,
              py: 1.4,
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: 2,
              bgcolor: '#1e66f5',
              textTransform: 'none',
              boxShadow: '0 0 24px rgba(30,102,245,0.3)',
              '&:hover': {
                bgcolor: '#1a5ce0',
                boxShadow: '0 0 32px rgba(30,102,245,0.45)',
              },
            }}
          >
            {t('welcome.signIn')}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/sign-up')}
            sx={{
              px: 5,
              py: 1.4,
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: 2,
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.4)',
                bgcolor: 'rgba(255,255,255,0.04)',
                color: 'white',
              },
            }}
          >
            {t('welcome.register')}
          </Button>
        </Stack>
      </Container>

      <WelcomeFooter mounted={mounted} />
    </Box>
  );
}
