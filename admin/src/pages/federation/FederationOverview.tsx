import { Avatar, Box, Card, CardActionArea, CardContent, Chip, Divider, Grid, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import HubIcon from '@mui/icons-material/Hub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationStats, useFederationSettings } from '@/hooks/useFederationData';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import QuickPostComposer from '@/pages/federation/QuickPostComposer';
import FederationTimeline from '@/pages/federation/FederationTimeline';

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
  value?: number;
  path: string;
}

function QuickLink({ icon, label, value, path }: QuickLinkProps) {
  const navigate = useNavigate();
  return (
    <CardActionArea
      onClick={() => navigate(path)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        {value !== undefined && value > 0 && (
          <Chip label={value} size="small" sx={{ minWidth: 32, height: 22, fontSize: '0.75rem' }} />
        )}
        <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
      </Stack>
    </CardActionArea>
  );
}

export default function FederationOverview() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { data: stats, isLoading: statsLoading } = useFederationStats(selectedSiteId);
  const { data: settings, isLoading: settingsLoading } = useFederationSettings(selectedSiteId);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

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

      <Grid container spacing={3}>
        {/* Left column — social feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          {settings?.enabled && (
            <>
              {/* Composer */}
              <QuickPostComposer siteId={selectedSiteId} handle={settings.webfinger_address} avatarUrl={settings.avatar_url} />

              {/* Timeline */}
              <FederationTimeline siteId={selectedSiteId} handle={settings.webfinger_address} avatarUrl={settings.avatar_url} />
            </>
          )}

          {!settings?.enabled && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <HubIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {t('federation.status.disabled')}
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Right column — profile & stats */}
        <Grid size={{ xs: 12, md: 5 }}>
          {/* Profile card */}
          {settings?.webfinger_address && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    src={settings.avatar_url || undefined}
                    sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}
                  >
                    <HubIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        fontFamily="monospace"
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        @{settings.webfinger_address}
                      </Typography>
                      <Tooltip title={t('federation.handle.copy')}>
                        <IconButton size="small" onClick={handleCopyHandle} aria-label={t('federation.handle.copy')}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t('federation.handle.description')}
                    </Typography>
                  </Box>
                </Stack>

                {/* Inline stats row */}
                <Stack
                  direction="row"
                  divider={<Divider orientation="vertical" flexItem />}
                  spacing={0}
                  sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}
                >
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>{stats?.follower_count ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('federation.stats.followers')}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>{stats?.outbound_activities ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('federation.stats.postsSyndicated')}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>{stats?.inbound_activities ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('federation.stats.inbound')}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Attention items */}
          {((stats?.pending_comments ?? 0) > 0 || (stats?.failed_activities ?? 0) > 0) && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                {(stats?.pending_comments ?? 0) > 0 && (
                  <CardActionArea
                    onClick={() => navigate('/federation/comments')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1, borderRadius: 1 }}
                  >
                    <CommentIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {stats!.pending_comments} {t('federation.stats.pendingComments').toLowerCase()}
                    </Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  </CardActionArea>
                )}
                {(stats?.failed_activities ?? 0) > 0 && (
                  <CardActionArea
                    onClick={() => navigate('/federation/activity')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1, borderRadius: 1 }}
                  >
                    <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {stats!.failed_activities} {t('federation.stats.failedDeliveries').toLowerCase()}
                    </Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  </CardActionArea>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card>
            <QuickLink
              icon={<PeopleIcon fontSize="small" />}
              label={t('federation.nav.followers')}
              value={stats?.follower_count}
              path="/federation/followers"
            />
            <Divider />
            <QuickLink
              icon={<CommentIcon fontSize="small" />}
              label={t('federation.nav.comments')}
              value={stats?.pending_comments}
              path="/federation/comments"
            />
            <Divider />
            <QuickLink
              icon={<HistoryIcon fontSize="small" />}
              label={t('federation.nav.activityLog')}
              path="/federation/activity"
            />
            <Divider />
            <QuickLink
              icon={<BlockIcon fontSize="small" />}
              label={t('federation.nav.blocklist')}
              path="/federation/blocks"
            />
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
