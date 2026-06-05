import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Box, Link, Stack, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import { useImprint } from '@/hooks/useImprint';

interface WelcomeFooterProps {
  mounted: boolean;
}

const linkSx = {
  fontSize: 'var(--w-text-xs)',
  color: 'var(--w-fg-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  '&:hover': { color: 'var(--w-fg)' },
} as const;

/**
 * Welcome footer (#812). Token-driven. The Imprint link appears only when the
 * deployment operator has configured imprint details (GDPR-required Impressum);
 * otherwise it stays hidden.
 */
export default function WelcomeFooter({ mounted }: WelcomeFooterProps) {
  const { t } = useTranslation();
  const { data: imprint } = useImprint();

  return (
    <Box
      component="footer"
      sx={{
        textAlign: 'center',
        pt: 6,
        pb: 4,
        mt: 8,
        position: 'relative',
        zIndex: 1,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.8s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        borderTop: '1px solid var(--w-border)',
      }}
    >
      <Stack
        direction="row"
        spacing={2.5}
        sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Typography component="span" sx={{ fontSize: 'var(--w-text-xs)', color: 'var(--w-fg-subtle)' }}>
          v{__APP_VERSION__}
        </Typography>
        <Dot />
        <Typography component="span" sx={{ fontSize: 'var(--w-text-xs)', color: 'var(--w-fg-subtle)' }}>
          {t('welcome.openSource')}
        </Typography>
        <Dot />
        <Link
          href="https://github.com/dominikdorfstetter/forja"
          target="_blank"
          rel="noopener"
          underline="none"
          sx={linkSx}
        >
          <GitHubIcon aria-hidden sx={{ fontSize: 14 }} />
          GitHub
        </Link>
        <Dot />
        <Link
          href="https://forja-docs.dorfstetter.at"
          target="_blank"
          rel="noopener"
          underline="none"
          sx={linkSx}
        >
          <MenuBookRoundedIcon aria-hidden sx={{ fontSize: 14 }} />
          {t('welcome.docs')}
        </Link>
        {imprint?.configured && (
          <>
            <Dot />
            <Link
              component={RouterLink}
              to="/imprint"
              data-testid="welcome.footer.imprint-link"
              underline="none"
              sx={linkSx}
            >
              <GavelRoundedIcon aria-hidden sx={{ fontSize: 14 }} />
              {t('imprint.link')}
            </Link>
          </>
        )}
        <Dot />
        <Typography component="span" sx={{ fontSize: 'var(--w-text-xs)', color: 'var(--w-fg-subtle)' }}>
          {t('welcome.madeWith')} 🦀
        </Typography>
      </Stack>
      <Typography component="span" sx={{ fontSize: 'var(--w-text-xs)', color: 'var(--w-fg-subtle)' }}>
        {t('welcome.madeInEu')} 🇪🇺
      </Typography>
    </Box>
  );
}

function Dot() {
  return <Box aria-hidden sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'var(--w-border-strong)' }} />;
}
