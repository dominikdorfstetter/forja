import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';

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
      }}
    >
      <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
        <Typography component="span" sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          {t('welcome.openSource')}
        </Typography>
        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)' }} />
        <Typography component="span" sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          {t('welcome.madeWith')} 🦀
        </Typography>
      </Stack>
    </Box>
  );
}
