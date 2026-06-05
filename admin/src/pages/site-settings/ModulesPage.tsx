import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ModulesTab from '@/pages/settings/ModulesTab';
import { SectionHead } from '@/components/design-system';

export default function ModulesPage() {
  const { t } = useTranslation();
  return (
    <Box>
      <SectionHead
        icon="widgets"
        title={t('siteSettings.modules.title', 'Modules')}
        subtitle={t(
          'siteSettings.modules.subtitle',
          'Enable or disable modules site-wide.',
        )}
      />
      <ModulesTab />
    </Box>
  );
}
