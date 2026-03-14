import { Box, Card, CardActionArea, CardContent, Chip, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import HubIcon from '@mui/icons-material/Hub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationStats, useFederationSettings, useFeaturedPosts, useFederationHealth } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import apiService from '@/services/api';
import QuickPostComposer from '@/pages/federation/QuickPostComposer';
import FederationTimeline from '@/pages/federation/FederationTimeline';
import InstanceHealthCard from '@/pages/federation/InstanceHealthCard';
import ProfileCard from '@/pages/federation/ProfileCard';
import ProfileEditCard from '@/pages/federation/ProfileEditCard';
import ModerationCard from '@/pages/federation/ModerationCard';
import PinnedPostsCard from '@/pages/federation/PinnedPostsCard';

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
  const { blockInstanceMutation } = useFederationMutations(selectedSiteId);
  const { data: healthData } = useFederationHealth(selectedSiteId);
  const { data: featuredPosts } = useFeaturedPosts(selectedSiteId);

  const queryClient = useQueryClient();

  const { data: notesData } = useQuery({
    queryKey: ['federation-notes', selectedSiteId],
    queryFn: () => apiService.getFederationNotes(selectedSiteId, { page: 1, page_size: 50 }),
    enabled: !!selectedSiteId && !!settings?.enabled,
    refetchInterval: 30_000,
  });
  const scheduledCount = (notesData?.data ?? []).filter((n) => n.status === 'scheduled').length;

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiService.deleteFederationNote(selectedSiteId, noteId),
    onSuccess: () => {
      enqueueSnackbar(t('federation.quickPost.deletedPost'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', selectedSiteId] });
    },
  });

  const editNoteMutation = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      apiService.updateFederationNote(selectedSiteId, noteId, { body }),
    onSuccess: () => {
      enqueueSnackbar(t('federation.quickPost.edited'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', selectedSiteId] });
    },
  });

  const isLoading = statsLoading || settingsLoading;

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
              <QuickPostComposer siteId={selectedSiteId} handle={settings.webfinger_address} avatarUrl={settings.avatar_url} />
              <FederationTimeline
                siteId={selectedSiteId}
                handle={settings.webfinger_address}
                avatarUrl={settings.avatar_url}
                onDeleteNote={(noteId) => deleteNoteMutation.mutate(noteId)}
                onEditNote={(noteId, body) => editNoteMutation.mutate({ noteId, body })}
              />
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
          {settings && <ProfileCard settings={settings} stats={stats} />}

          {/* Scheduled posts indicator */}
          {settings?.enabled && scheduledCount > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardActionArea
                onClick={() => navigate('/federation/activity')}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderRadius: 1 }}
              >
                <ScheduleIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {t('federation.quickPost.scheduledCount', { count: scheduledCount })}
                </Typography>
                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              </CardActionArea>
            </Card>
          )}

          {settings?.enabled && <ProfileEditCard siteId={selectedSiteId} settings={settings} />}
          {settings?.enabled && <ModerationCard settings={settings} siteId={selectedSiteId} />}
          {settings?.enabled && <PinnedPostsCard siteId={selectedSiteId} featuredPosts={featuredPosts ?? []} />}

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
              label={t('federation.nav.blockedActors')}
              path="/federation/blocks"
            />
          </Card>

          {/* Instance Health */}
          {settings?.enabled && healthData && (
            <Box sx={{ mt: 3 }}>
              <InstanceHealthCard
                healthData={healthData}
                onBlockInstance={(domain) => blockInstanceMutation.mutate({ domain })}
              />
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
