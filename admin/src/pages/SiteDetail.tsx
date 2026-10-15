import { useParams, useNavigate } from 'react-router';
import { Alert, Box, Grid } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSiteMembers } from '@/services/members';
import { getSite, getStorageUsage } from '@/services/sites';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { PageHeader } from '@/components/shared/listPageV2';
import LoadingState from '@/components/shared/LoadingState';
import SiteLocalesManager from '@/components/sites/SiteLocalesManager';
import EntityHistoryPanel from '@/components/shared/EntityHistoryPanel';
import { M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';
import SiteDetailSection from './site-detail/SiteDetailSection';
import SiteInfoCard from './site-detail/SiteInfoCard';
import SiteMetadataCard from './site-detail/SiteMetadataCard';
import SiteStatCards from './site-detail/SiteStatCards';
import SiteSysadminPanel from './site-detail/SiteSysadminPanel';
import { useSiteDetailActions } from './site-detail/useSiteDetailActions';

export default function SiteDetailPage() {
  const { t } = useTranslation();
  const { id: urlId } = useParams<{ id: string }>();
  const { selectedSiteId } = useSiteContext();
  // Param-less route (/site-detail, user-facing) falls back to the
  // currently selected site. The sysadmin route (/sites/:id) still
  // wins whenever an explicit id is in the URL so deep-links to a
  // different site keep working.
  const id = urlId || selectedSiteId;
  const navigate = useNavigate();

  const { isAdmin, isMaster } = useAuth();

  const { data: site, isLoading, error } = useQuery({
    queryKey: queryKeys.site(id),
    queryFn: () => getSite(id),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.siteMembers(id),
    queryFn: () => getSiteMembers(id),
    enabled: !!id,
  });

  const { data: storage } = useQuery({
    queryKey: queryKeys.siteStorage(id),
    queryFn: () => getStorageUsage(id),
    enabled: !!id,
  });

  const actions = useSiteDetailActions(id, isMaster);

  if (!id) return <Alert severity="info">{t('common.noSiteSelected')}</Alert>;
  if (isLoading) return <LoadingState label={t('siteDetail.loading')} />;
  if (error || !site) return <Alert severity="error">{t('siteDetail.loadFailed')}</Alert>;

  return (
    <Box data-testid="site-detail.page">
      <PageHeader
        icon="domain"
        breadcrumb={`${t('layout.sidebar.sites')} / ${site.name}`}
        title={site.name}
        subtitle={site.slug}
        actions={
          <M3Button
            variant="outlined"
            size="md"
            icon="settings"
            onClick={() => navigate('/site-settings')}
            data-testid="site-detail.btn.open-settings"
          >
            {t('siteDetail.openSettings')}
          </M3Button>
        }
      />

      <SiteStatCards members={members} storage={storage} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SiteInfoCard site={site} canEdit={isAdmin} onSaveField={actions.saveField} />
          <SiteLocalesManager siteId={id} />
          {isMaster && <SiteSysadminPanel isActive={site.is_active} actions={actions} />}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <SiteMetadataCard site={site} />
          <SiteDetailSection title={t('entityHistory.title')}>
            <EntityHistoryPanel entityType="site" entityId={id} />
          </SiteDetailSection>
        </Grid>
      </Grid>
    </Box>
  );
}
