import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSite, getSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import SeoDefaultsEditor from './SeoDefaultsEditor';
import RobotsTxtEditor from './RobotsTxtEditor';
import { SectionHead } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';

export default function SeoPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  const { data: site } = useQuery({
    queryKey: queryKeys.site(selectedSiteId),
    queryFn: () => getSite(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  if (isLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <Box data-testid="site-settings.seo.page">
      <SectionHead
        icon="travel_explore"
        title={t('siteSettings.seo.title', 'SEO')}
        subtitle={t(
          'siteSettings.seo.subtitle',
          'Defaults applied site-wide. Individual posts can override any of these.',
        )}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SeoDefaultsEditor settings={settings} siteName={site?.name ?? ''} />
        <RobotsTxtEditor settings={settings} baseUrl={site?.base_url} />
      </Box>
    </Box>
  );
}
