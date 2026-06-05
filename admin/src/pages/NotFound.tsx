import { useTranslation } from 'react-i18next';
import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router';
import { M3Button } from '@/components/design-system';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h3" component="h1">{t('notFound.title')}</Typography>
      <Typography variant="h6" component="p" sx={{ mb: 2 }}>{t('notFound.subtitle')}</Typography>
      <M3Button variant="filled" icon="home" onClick={() => navigate('/')}>
        {t('notFound.goToDashboard')}
      </M3Button>
    </Box>
  );
}
