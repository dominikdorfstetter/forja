import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  ButtonBase,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSiteMembers } from '@/services/members';
import { getSite, getSiteSettings, getStorageUsage, updateSite, updateSiteSettings } from '@/services/sites';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import {
  PageHeader,
} from '@/components/shared/listPageV2';
import LoadingState from '@/components/shared/LoadingState';
import SiteLocalesManager from '@/components/sites/SiteLocalesManager';
import EntityHistoryPanel from '@/components/shared/EntityHistoryPanel';
import InlineEditField from '@/components/shared/InlineEditField';
import CopyableId from '@/components/shared/CopyableId';
import { M3Button, Icon } from '@/components/design-system';

const GB = 1024 ** 3;

function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

interface StatCardProps {
  icon: string;
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  progress?: number;
  onClick?: () => void;
  testId?: string;
}

/**
 * Click-through stat card for the site detail dashboard. Each card
 * deep-links to the management surface relevant to the number it
 * shows — members count → /site-settings/members, storage →
 * /site-settings/content, etc. — so the detail page reads as a
 * jumping-off point rather than a static info card.
 */
function StatCard({ icon, label, primary, secondary, progress, onClick, testId }: StatCardProps) {
  const sharedSx = {
    width: '100%',
    textAlign: 'left' as const,
    display: 'block',
    p: 2.25,
    borderRadius: '16px',
    bgcolor: 'var(--surface-container-low)',
    border: '1px solid var(--outline-variant)',
    transition: 'background-color 140ms, border-color 140ms, transform 140ms',
    ...(onClick
      ? {
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'var(--surface-container)',
            borderColor: 'color-mix(in srgb, var(--primary) 45%, var(--outline-variant))',
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': { outline: '2px solid var(--primary)', outlineOffset: 2 },
        }
      : {}),
  };

  const body = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '10px',
            bgcolor: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
          }}
        >
          <Icon name={icon} size={18} />
        </Box>
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            color: 'var(--on-surface-variant)',
            textTransform: 'uppercase',
            fontVariationSettings: '"wght" 600, "opsz" 11',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        component="div"
        sx={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--on-surface)',
          fontVariationSettings: '"wght" 700, "opsz" 24',
          letterSpacing: -0.3,
          lineHeight: 1.15,
          minHeight: 28,
        }}
      >
        {primary}
      </Typography>
      {progress != null && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, progress))}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: 'var(--surface-container-highest)',
              '& .MuiLinearProgress-bar': {
                bgcolor: progress > 85 ? 'var(--err)' : 'var(--primary)',
                borderRadius: 999,
              },
            }}
          />
        </Box>
      )}
      {secondary && (
        <Typography
          component="div"
          sx={{
            mt: 0.75,
            fontSize: 12,
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 500, "opsz" 12',
          }}
        >
          {secondary}
        </Typography>
      )}
    </>
  );

  if (onClick) {
    return (
      <ButtonBase focusRipple onClick={onClick} data-testid={testId} sx={sharedSx}>
        {body}
      </ButtonBase>
    );
  }
  return (
    <Box data-testid={testId} sx={sharedSx}>
      {body}
    </Box>
  );
}

export default function SiteDetailPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { id: urlId } = useParams<{ id: string }>();
  const { selectedSiteId } = useSiteContext();
  // Param-less route (/site-detail, user-facing) falls back to the
  // currently selected site. The sysadmin route (/sites/:id) still
  // wins whenever an explicit id is in the URL so deep-links to a
  // different site keep working.
  const id = urlId || selectedSiteId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const { isAdmin, isMaster } = useAuth();

  const { data: site, isLoading, error } = useQuery({
    queryKey: ['site', id],
    queryFn: () => getSite(id!),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['site', id, 'members'],
    queryFn: () => getSiteMembers(id!),
    enabled: !!id,
  });

  const { data: storage } = useQuery({
    queryKey: ['site', id, 'storage'],
    queryFn: () => getStorageUsage(id!),
    enabled: !!id,
  });

  const { data: settings } = useQuery({
    queryKey: ['site', id, 'settings'],
    queryFn: () => getSiteSettings(id!),
    enabled: !!id && isMaster,
  });

  const [quotaInputGb, setQuotaInputGb] = useState<string>('');

  useEffect(() => {
    if (settings?.storage_quota_bytes) {
      setQuotaInputGb((settings.storage_quota_bytes / GB).toFixed(2));
    }
  }, [settings?.storage_quota_bytes]);

  const updateSiteMutation = useMutation({
    mutationFn: (data: { is_active?: boolean }) => updateSite(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      showSuccess(t('siteDetail.messages.updated'));
    },
    onError: showError,
  });

  const updateQuotaMutation = useMutation({
    mutationFn: (quotaBytes: number) =>
      updateSiteSettings(id!, { storage_quota_bytes: quotaBytes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', id, 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['site', id, 'storage'] });
      showSuccess(t('siteDetail.messages.quotaUpdated'));
    },
    onError: showError,
  });

  if (!id) return <Alert severity="info">{t('common.noSiteSelected')}</Alert>;
  if (isLoading) return <LoadingState label={t('siteDetail.loading')} />;
  if (error || !site) return <Alert severity="error">{t('siteDetail.loadFailed')}</Alert>;

  const owner = members.find((m) => m.role === 'owner');
  const ownerLabel = owner?.name || owner?.email || t('siteDetail.stats.ownerMissing');
  const activeMemberCount = members.length;
  const storagePercent = storage?.usage_percent ?? 0;
  const storageUsedLabel = storage
    ? t('siteDetail.stats.storageOf', {
        used: bytesToHuman(storage.total_bytes),
        quota: bytesToHuman(storage.quota_bytes),
      })
    : undefined;

  const handleToggleActive = () => {
    updateSiteMutation.mutate({ is_active: !site.is_active });
  };

  const handleSaveQuota = () => {
    const gb = parseFloat(quotaInputGb);
    if (!Number.isFinite(gb) || gb <= 0) return;
    updateQuotaMutation.mutate(Math.round(gb * GB));
  };

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

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon="group"
            label={t('siteDetail.stats.members')}
            primary={activeMemberCount}
            secondary={t('siteDetail.stats.membersHint')}
            onClick={() => navigate('/site-settings/members')}
            testId="site-detail.stat.members"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon="shield_person"
            label={t('siteDetail.stats.owner')}
            primary={
              <Box
                component="span"
                sx={{
                  fontSize: owner ? 18 : 16,
                  fontWeight: owner ? 700 : 500,
                  color: owner ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ownerLabel}
              </Box>
            }
            secondary={owner?.email && owner.email !== ownerLabel ? owner.email : undefined}
            onClick={() => navigate('/site-settings/members')}
            testId="site-detail.stat.owner"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon="database"
            label={t('siteDetail.stats.storage')}
            primary={`${Math.round(storagePercent)}%`}
            progress={storagePercent}
            secondary={storageUsedLabel}
            onClick={() => navigate('/site-settings/content')}
            testId="site-detail.stat.storage"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: '16px',
              bgcolor: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 700, "opsz" 16',
                mb: 2,
              }}
            >
              {t('siteDetail.siteInfo')}
            </Typography>
            <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
                  {t('siteDetail.fields.name')}
                </Typography>
                <InlineEditField
                  value={site.name}
                  variant="body1"
                  disabled={!isAdmin}
                  onSave={async (newName) => {
                    await updateSite(id!, { name: newName });
                    queryClient.invalidateQueries({ queryKey: ['site', id] });
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
                  {t('siteDetail.fields.slug')}
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'var(--font-mono)' }}>
                  {site.slug}
                </Typography>
              </Grid>
              <Grid size={12}>
                <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
                  {t('siteDetail.fields.description')}
                </Typography>
                <InlineEditField
                  value={site.description || ''}
                  variant="body1"
                  disabled={!isAdmin}
                  onSave={async (newDescription) => {
                    await updateSite(id!, { description: newDescription });
                    queryClient.invalidateQueries({ queryKey: ['site', id] });
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
                  {t('siteDetail.fields.timezone')}
                </Typography>
                <Typography variant="body1">{site.timezone}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
                  {t('siteDetail.fields.status')}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.1,
                    height: 22,
                    mt: 0.25,
                    borderRadius: '999px',
                    bgcolor: site.is_active
                      ? 'var(--tertiary-container)'
                      : 'var(--surface-container-high)',
                    color: site.is_active
                      ? 'var(--on-tertiary-container)'
                      : 'var(--on-surface-variant)',
                    border: site.is_active ? 'none' : '1px solid var(--outline-variant)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariationSettings: '"wght" 600, "opsz" 11',
                    letterSpacing: 0.3,
                  }}
                >
                  {site.is_active ? t('common.status.active') : t('common.status.inactive')}
                </Box>
              </Grid>
            </Grid>
          </Box>

          <SiteLocalesManager siteId={id!} />

          {isMaster && (
            <Box
              data-testid="site-detail.sysadmin"
              sx={{
                mt: 3,
                p: 3,
                borderRadius: '16px',
                bgcolor: 'color-mix(in srgb, var(--primary) 8%, var(--surface-container-low))',
                border: '1px solid color-mix(in srgb, var(--primary) 35%, var(--outline-variant))',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Icon name="admin_panel_settings" size={18} color="var(--primary)" />
                <Typography
                  component="h2"
                  sx={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    fontVariationSettings: '"wght" 700, "opsz" 16',
                  }}
                >
                  {t('siteDetail.sysadmin.title')}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: 12,
                  color: 'var(--on-surface-variant)',
                  mb: 2.5,
                }}
              >
                {t('siteDetail.sysadmin.subtitle')}
              </Typography>

              <Box sx={{ mb: 2.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={site.is_active}
                      onChange={handleToggleActive}
                      disabled={updateSiteMutation.isPending}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {t('siteDetail.sysadmin.enabledLabel')}
                    </Typography>
                  }
                />
                <Typography sx={{ fontSize: 12, color: 'var(--on-surface-variant)', ml: 5 }}>
                  {t('siteDetail.sysadmin.enabledHelp')}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'var(--outline-variant)', my: 2 }} />

              <Typography
                component="div"
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--on-surface)',
                  mb: 0.5,
                }}
              >
                {t('siteDetail.sysadmin.quotaLabel')}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'var(--on-surface-variant)', mb: 1.5 }}>
                {t('siteDetail.sysadmin.quotaHelp')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  type="number"
                  size="small"
                  value={quotaInputGb}
                  onChange={(e) => setQuotaInputGb(e.target.value)}
                  slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
                  sx={{ width: 160 }}
                  data-testid="site-detail.input.quota"
                />
                <M3Button
                  variant="filled"
                  size="sm"
                  icon="save"
                  onClick={handleSaveQuota}
                  disabled={updateQuotaMutation.isPending || quotaInputGb === ''}
                  data-testid="site-detail.btn.save-quota"
                >
                  {t('siteDetail.sysadmin.quotaSave')}
                </M3Button>
              </Box>
            </Box>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: '16px',
              bgcolor: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 700, "opsz" 16',
                mb: 2,
              }}
            >
              {t('siteDetail.metadata')}
            </Typography>
            <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />

            <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
              {t('siteDetail.fields.id')}
            </Typography>
            <Box sx={{ mb: 1.5 }}>
              <CopyableId value={site.id} />
            </Box>

            <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
              {t('siteDetail.fields.created')}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {fmt(site.created_at, 'PPpp')}
            </Typography>

            <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
              {t('siteDetail.fields.updated')}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {fmt(site.updated_at, 'PPpp')}
            </Typography>

            <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />

            <Typography
              component="div"
              sx={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', letterSpacing: 0.3, textTransform: 'uppercase', mb: 1 }}
            >
              {t('siteDetail.quickLinks')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <M3Button variant="text" size="sm" icon="article" onClick={() => navigate('/blogs')}>
                {t('layout.sidebar.blogs')}
              </M3Button>
              <M3Button variant="text" size="sm" icon="perm_media" onClick={() => navigate('/media')}>
                {t('layout.sidebar.media')}
              </M3Button>
              <M3Button variant="text" size="sm" icon="sell" onClick={() => navigate('/taxonomy')}>
                {t('layout.sidebar.taxonomy')}
              </M3Button>
            </Box>
          </Box>

          <Box
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 700, "opsz" 16',
                mb: 2,
              }}
            >
              {t('entityHistory.title')}
            </Typography>
            <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />
            <EntityHistoryPanel entityType="site" entityId={id!} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
