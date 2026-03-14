import { Box, Card, CardActionArea, CardContent, Chip, Grid, IconButton, Tooltip, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SendIcon from '@mui/icons-material/Send';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import HubIcon from '@mui/icons-material/Hub';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationStats, useFederationSettings } from '@/hooks/useFederationData';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import QuickPostComposer from '@/pages/federation/QuickPostComposer';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, icon, color = 'primary.main' }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

function NavCard({ title, description, icon, path }: NavCardProps) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardActionArea onClick={() => navigate(path)} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export default function FederationOverview() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { data: stats, isLoading: statsLoading } = useFederationStats(selectedSiteId);
  const { data: settings, isLoading: settingsLoading } = useFederationSettings(selectedSiteId);
  const { enqueueSnackbar } = useSnackbar();

  const isLoading = statsLoading || settingsLoading;

  const handleCopyHandle = () => {
    if (settings?.webfinger_address) {
      navigator.clipboard.writeText(`@${settings.webfinger_address}`);
      enqueueSnackbar(t('federation.handle.copied'), { variant: 'success' });
    }
  };

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-overview.page">
        <PageHeader title={t('federation.title')} subtitle={t('federation.subtitle')} />
        <EmptyState icon={<HubIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.noSiteDescription')} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-overview.page">
        <PageHeader title={t('federation.title')} subtitle={t('federation.subtitle')} />
        <LoadingState label={t('federation.loadingData')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-overview.page">
      <PageHeader title={t('federation.title')} subtitle={t('federation.subtitle')} />

      {settings?.webfinger_address && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">{t('federation.handle.title')}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="h5" fontFamily="monospace">
                @{settings.webfinger_address}
              </Typography>
              <Tooltip title={t('federation.handle.copy')}>
                <IconButton size="small" onClick={handleCopyHandle} aria-label={t('federation.handle.copy')}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {t('federation.handle.description')}
            </Typography>
          </CardContent>
        </Card>
      )}

      {settings?.enabled && <QuickPostComposer siteId={selectedSiteId} />}

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          label={settings?.enabled ? t('federation.status.enabled') : t('federation.status.disabled')}
          color={settings?.enabled ? 'success' : 'default'}
          size="small"
        />
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t('federation.stats.followers')} value={stats?.followersCount ?? 0} icon={<PeopleIcon fontSize="large" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t('federation.stats.postsSyndicated')} value={stats?.postsSyndicated ?? 0} icon={<SendIcon fontSize="large" />} color="success.main" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t('federation.stats.pendingComments')} value={stats?.pendingComments ?? 0} icon={<CommentIcon fontSize="large" />} color="warning.main" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label={t('federation.stats.failedDeliveries')} value={stats?.failedDeliveries ?? 0} icon={<ErrorOutlineIcon fontSize="large" />} color="error.main" />
        </Grid>
      </Grid>

      {/* Navigation to sub-pages */}
      <Typography variant="h6" sx={{ mb: 2 }}>{t('federation.manage')}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <NavCard title={t('federation.nav.followers')} description={t('federation.nav.followersDesc')} icon={<PeopleIcon />} path="/federation/followers" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <NavCard title={t('federation.nav.comments')} description={t('federation.nav.commentsDesc')} icon={<CommentIcon />} path="/federation/comments" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <NavCard title={t('federation.nav.activityLog')} description={t('federation.nav.activityLogDesc')} icon={<HistoryIcon />} path="/federation/activity" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <NavCard title={t('federation.nav.blocklist')} description={t('federation.nav.blocklistDesc')} icon={<BlockIcon />} path="/federation/blocks" />
        </Grid>
      </Grid>
    </Box>
  );
}
