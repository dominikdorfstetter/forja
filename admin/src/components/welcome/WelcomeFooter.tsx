import { useTranslation } from 'react-i18next';
import { Box, Link, Stack, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';

interface WelcomeFooterProps {
  mounted: boolean;
}

export default function WelcomeFooter({ mounted }: WelcomeFooterProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        textAlign: 'center',
        pb: 3,
        position: 'relative',
        zIndex: 1,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.8s ease 1.1s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={2.5} justifyContent="center" alignItems="center" flexWrap="wrap">
        <Typography component="span" sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
          v{__APP_VERSION__}
        </Typography>
        <Dot />
        <Typography component="span" sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          {t('welcome.openSource')}
        </Typography>
        <Dot />
        <Link
          href="https://github.com/dominikdorfstetter/forja"
          target="_blank"
          rel="noopener"
          underline="none"
          sx={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            '&:hover': { color: 'rgba(255,255,255,0.7)' },
          }}
        >
          <GitHubIcon sx={{ fontSize: 14 }} />
          GitHub
        </Link>
        <Dot />
        <Link
          href="https://forja-docs.dorfstetter.at"
          target="_blank"
          rel="noopener"
          underline="none"
          sx={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            '&:hover': { color: 'rgba(255,255,255,0.7)' },
          }}
        >
          <MenuBookRoundedIcon sx={{ fontSize: 14 }} />
          {t('welcome.docs')}
        </Link>
        <Dot />
        <Typography component="span" sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          {t('welcome.madeWith')} 🦀
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
        <Typography component="span" sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)' }}>
          {t('welcome.createdBy', { name: 'Dominik Dorfstetter' })}
        </Typography>
        <Dot />
        <Typography component="span" sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)' }}>
          {t('welcome.madeInEu')} 🇪🇺
        </Typography>
      </Stack>
    </Box>
  );
}

function Dot() {
  return (
    <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)' }} />
  );
}
