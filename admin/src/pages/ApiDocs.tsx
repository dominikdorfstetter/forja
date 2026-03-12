import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/store/AuthContext';

const IFRAME_SX = {
  width: '100%',
  height: 'calc(100vh - 230px)',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
} as const;

export default function ApiDocsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader title={t('apiDocs.title')} subtitle={t('apiDocs.subtitle')} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('apiDocs.consumerTab', 'Consumer API')} />
        {isAdmin && <Tab label={t('apiDocs.adminTab', 'Admin API')} />}
      </Tabs>

      {tab === 0 && (
        <Box
          component="iframe"
          src="/api-docs/consumer/"
          sx={IFRAME_SX}
          title={t('apiDocs.consumerTab', 'Consumer API')}
        />
      )}

      {tab === 1 && isAdmin && (
        <Box
          component="iframe"
          src="/api-docs/admin"
          sx={IFRAME_SX}
          title={t('apiDocs.adminTab', 'Admin API')}
        />
      )}
    </Box>
  );
}
