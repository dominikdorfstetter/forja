import { useTranslation } from 'react-i18next';
import { Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h3" component="h1">{t('notFound.title')}</Typography>
      <Typography variant="h6" sx={{ mb: 2 }}>{t('notFound.subtitle')}</Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')}>
        {t('notFound.goToDashboard')}
      </Button>
    </Box>
  );
}
