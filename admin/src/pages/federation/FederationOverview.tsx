import { useState } from 'react';
import { Avatar, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, Grid, IconButton, InputLabel, List, ListItemButton, ListItemText, MenuItem, Paper, Select, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import HubIcon from '@mui/icons-material/Hub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import PushPinIcon from '@mui/icons-material/PushPin';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSiteContext } from '@/store/SiteContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFederationStats, useFederationSettings, useFeaturedPosts } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import apiService from '@/services/api';
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

interface PinnedPostsCardProps {
  siteId: string;
  featuredPosts: import('@/types/api').FederationFeaturedPost[];
  onPin: () => void;
  onUnpin: (contentId: string) => void;
}

function PinnedPostsCard({ featuredPosts, onPin, onUnpin }: PinnedPostsCardProps) {
  const { t } = useTranslation();
  const maxReached = featuredPosts.length >= 3;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PushPinIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary">
              {t('federation.featured.title')}
            </Typography>
          </Stack>
          <Tooltip title={maxReached ? t('federation.featured.maxReached') : t('federation.featured.pin')}>
            <span>
              <IconButton size="small" onClick={onPin} disabled={maxReached}>
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
          {t('federation.featured.description')}
        </Typography>
        {featuredPosts.length === 0 && (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            {t('federation.featured.empty')}
          </Typography>
        )}
        {featuredPosts.map((post) => (
          <Stack key={post.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {post.title ?? post.slug ?? post.content_id}
            </Typography>
            <Tooltip title={t('federation.featured.unpin')}>
              <IconButton size="small" onClick={() => onUnpin(post.content_id)}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </CardContent>
    </Card>
  );
}

interface PinPostDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  alreadyPinned: Set<string>;
  onSelect: (contentId: string) => void;
}

function PinPostDialog({ open, onClose, siteId, alreadyPinned, onSelect }: PinPostDialogProps) {
  const { t } = useTranslation();

  const { data: blogsData, isLoading } = useQuery({
    queryKey: ['blogs-for-pin', siteId],
    queryFn: () => apiService.getBlogs(siteId, { page: 1, page_size: 100, status: 'Published' }),
    enabled: open && !!siteId,
  });

  const blogs = (blogsData?.data ?? []).filter((b) => !alreadyPinned.has(b.content_id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('federation.featured.selectPost')}</DialogTitle>
      <DialogContent dividers>
        {isLoading && <Typography variant="body2" color="text.secondary">Loading...</Typography>}
        {!isLoading && blogs.length === 0 && (
          <Typography variant="body2" color="text.secondary">{t('federation.featured.empty')}</Typography>
        )}
        <List disablePadding>
          {blogs.map((blog) => (
            <ListItemButton key={blog.id} onClick={() => onSelect(blog.content_id)}>
              <ListItemText primary={blog.slug ?? blog.id} secondary={blog.author} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FederationOverview() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { data: stats, isLoading: statsLoading } = useFederationStats(selectedSiteId);
  const { data: settings, isLoading: settingsLoading } = useFederationSettings(selectedSiteId);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { updateSettings, pinPostMutation, unpinPostMutation } = useFederationMutations(selectedSiteId);
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

  const [editingProfile, setEditingProfile] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [bio, setBio] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  const bioValue = bio ?? settings?.summary ?? '';
  const avatarUrlValue = avatarUrl ?? settings?.avatar_url ?? '';

  const handleSaveProfile = () => {
    updateSettings.mutate({ summary: bioValue, avatar_url: avatarUrlValue });
    setEditingProfile(false);
  };

  const handleMediaSelected = async (mediaId: string | null) => {
    if (!mediaId) return;
    try {
      const media = await apiService.getMediaById(mediaId);
      if (media.public_url) {
        setAvatarUrl(media.public_url);
      }
    } catch { /* ignore */ }
  };

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

          {/* Edit profile */}
          {settings?.enabled && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                {!editingProfile ? (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      {settings.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {settings.summary}
                        </Typography>
                      )}
                      {!settings.summary && (
                        <Typography variant="body2" color="text.disabled" fontStyle="italic">
                          {t('federation.profile.noBio')}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title={t('federation.profile.edit')}>
                      <IconButton size="small" onClick={() => setEditingProfile(true)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar
                        src={avatarUrlValue || undefined}
                        sx={{ width: 56, height: 56, cursor: 'pointer' }}
                        onClick={() => setPickerOpen(true)}
                      >
                        <HubIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label={t('federation.settings.avatarUrl')}
                          value={avatarUrlValue}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          inputProps={{ maxLength: 500 }}
                        />
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<ImageIcon />}
                          onClick={() => setPickerOpen(true)}
                          sx={{ mt: 0.5 }}
                        >
                          {t('federation.settings.chooseFromMedia')}
                        </Button>
                      </Box>
                    </Stack>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      label={t('federation.settings.bio')}
                      helperText={t('federation.settings.bioHelper')}
                      value={bioValue}
                      onChange={(e) => setBio(e.target.value)}
                      inputProps={{ maxLength: 500 }}
                    />
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => { setEditingProfile(false); setBio(undefined); setAvatarUrl(undefined); }}>
                        {t('common.actions.cancel')}
                      </Button>
                      <Button variant="contained" size="small" onClick={handleSaveProfile}>
                        {t('common.actions.save')}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Moderation settings — accessible to site owners */}
          {settings?.enabled && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>{t('federation.settings.moderation')}</Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>{t('federation.settings.mode')}</InputLabel>
                  <Select
                    value={settings.moderation_mode ?? 'queue_all'}
                    label={t('federation.settings.mode')}
                    onChange={(e) => updateSettings.mutate({ moderation_mode: e.target.value })}
                  >
                    <MenuItem value="queue_all">{t('federation.settings.modeQueueAll')}</MenuItem>
                    <MenuItem value="auto_approve">{t('federation.settings.modeAutoApprove')}</MenuItem>
                    <MenuItem value="followers_only">{t('federation.settings.modeFollowersOnly')}</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.auto_publish ?? true}
                      onChange={(e) => updateSettings.mutate({ auto_publish: e.target.checked })}
                    />
                  }
                  label={t('federation.settings.autoPublish')}
                />
              </CardContent>
            </Card>
          )}

          {/* Pinned Posts */}
          {settings?.enabled && (
            <PinnedPostsCard
              siteId={selectedSiteId}
              featuredPosts={featuredPosts ?? []}
              onPin={() => setPinDialogOpen(true)}
              onUnpin={(contentId) => unpinPostMutation.mutate(contentId)}
            />
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

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        siteId={selectedSiteId}
        onSelect={handleMediaSelected}
      />

      <PinPostDialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        siteId={selectedSiteId}
        alreadyPinned={new Set((featuredPosts ?? []).map((p) => p.content_id))}
        onSelect={(contentId) => {
          pinPostMutation.mutate(contentId);
          setPinDialogOpen(false);
        }}
      />
    </Box>
  );
}
