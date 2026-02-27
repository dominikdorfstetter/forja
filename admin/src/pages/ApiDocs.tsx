import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/shared/PageHeader';

export default function ApiDocsPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <PageHeader title={t('apiDocs.title')} subtitle={t('apiDocs.subtitle')} />
      <Box
        component="iframe"
        src="/api-docs/"
        sx={{
          width: '100%',
          height: 'calc(100vh - 180px)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
        title={t('apiDocs.title')}
      />
    </Box>
  );
}
