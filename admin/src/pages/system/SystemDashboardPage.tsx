import { Box, Grid, Alert, LinearProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getHealth } from '@/services/health';
import { getSites, getSystemStorageOverview } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import { DataTableV2, type DataTableV2Column } from '@/components/shared/listPageV2';
import { Icon, M3IconButton } from '@/components/design-system';
import GlobalCacheSection from '@/components/cache/GlobalCacheSection';
import type { HealthResponse, SiteStorageSummary } from '@/types/api';

type HealthService = HealthResponse['services'][number];

const STATUS_CONFIG = {
  healthy: { icon: 'check_circle', tone: 'tertiary', labelKey: 'common.status.healthy' },
  degraded: { icon: 'warning', tone: 'warn', labelKey: 'common.status.degraded' },
  unhealthy: { icon: 'error', tone: 'err', labelKey: 'common.status.unhealthy' },
} as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Map the backend's implementation-specific service names (Database, Redis
 * (Cache), Clerk (IdP), Storage (Local)) to friendly, user-facing labels.
 * The user shouldn't care that caching runs on Redis or that identity is
 * provided by Clerk — they care which capability is reachable.
 */
function serviceDisplayName(rawName: string, t: TFunction): string {
  const lower = rawName.toLowerCase();
  if (lower.includes('database') || lower.includes('datenbank')) return t('system.dashboard.services.database');
  if (lower.includes('cache') || lower.includes('redis')) return t('system.dashboard.services.cache');
  if (lower.includes('clerk') || lower.includes('idp')) return t('system.dashboard.services.idp');
  if (lower.includes('storage')) return t('system.dashboard.services.storage');
  return rawName;
}

/**
 * Tonal status pill matching the chip vocabulary used in legal /
 * navigation / system sites tables. Three tones cover every status
 * we surface on the dashboard: healthy (tertiary), degraded (warn),
 * unhealthy (err).
 */
function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'tertiary' | 'warn' | 'err' | 'neutral';
}) {
  const paint =
    tone === 'tertiary'
      ? { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' }
      : tone === 'warn'
        ? { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' }
        : tone === 'err'
          ? { bg: 'color-mix(in oklch, var(--err) 18%, transparent)', fg: 'var(--err)' }
          : {
              bg: 'transparent',
              fg: 'var(--on-surface-variant)',
              border: '1px solid var(--outline-variant)',
            };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border ?? 'none',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </Box>
  );
}

/**
 * Tokenised card with a tonal icon tile + title row and arbitrary
 * content slot. Replaces MUI Paper + Stack + Typography anchors to
 * make every dashboard card look the same.
 */
function DashboardCard({
  icon,
  title,
  tone,
  action,
  children,
  'data-testid': testId,
}: {
  icon: string;
  title: string;
  tone?: 'primary' | 'tertiary' | 'warn' | 'err';
  action?: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
}) {
  const paint = {
    primary: { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
    tertiary: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
    warn: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
    err: { bg: 'color-mix(in oklch, var(--err) 18%, transparent)', fg: 'var(--err)' },
  }[tone ?? 'primary'];
  return (
    <Box
      data-testid={testId}
      sx={{
        height: '100%',
        p: 3,
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '20px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: paint.bg,
            color: paint.fg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} />
        </Box>
        <Box
          component="h2"
          sx={{
            m: 0,
            flex: 1,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 600, "opsz" 16',
          }}
        >
          {title}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

export default function SystemDashboardPage() {
  const { t } = useTranslation();

  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth(),
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => getSites(),
  });

  const { data: storageOverview } = useQuery({
    queryKey: ['system-storage-overview'],
    queryFn: () => getSystemStorageOverview(),
  });

  if (healthLoading || sitesLoading) return <LoadingState />;

  const statusCfg = health ? STATUS_CONFIG[health.status as keyof typeof STATUS_CONFIG] : null;
  const statusTone = statusCfg?.tone ?? 'err';

  type ServiceRow = HealthService & { _kind?: 'storage' };
  const serviceRows: ServiceRow[] = health ? [...health.services] : [];
  if (health?.storage) {
    serviceRows.push({ ...health.storage, _kind: 'storage' });
  }

  const serviceColumns: DataTableV2Column<ServiceRow>[] = [
    {
      key: 'name',
      label: t('settings.systemInfo.service'),
      width: 'minmax(140px, 1fr)',
      render: (svc) => (
        <Box component="span" sx={{ fontWeight: 500 }}>
          {serviceDisplayName(svc.name, t)}
        </Box>
      ),
    },
    {
      key: 'status',
      label: t('settings.systemInfo.status'),
      width: '120px',
      render: (svc) => (
        <StatusPill
          label={svc.status === 'up' ? t('common.status.up') : t('common.status.down')}
          tone={svc.status === 'up' ? 'tertiary' : 'err'}
        />
      ),
    },
    {
      key: 'latency',
      label: t('settings.systemInfo.latency'),
      width: '100px',
      muted: true,
      render: (svc) => (svc.latency_ms != null ? `${svc.latency_ms} ms` : '—'),
    },
    {
      key: 'details',
      label: t('settings.systemInfo.details'),
      width: 'minmax(200px, 2fr)',
      render: (svc) => {
        if (svc._kind === 'storage') {
          const s = svc as HealthService & {
            bucket?: string;
            used_percent?: number;
            available_bytes?: number;
            total_bytes?: number;
          };
          const details: string[] = [];
          if (s.bucket) details.push(t('system.dashboard.storage.bucket', { name: s.bucket }));
          if (s.used_percent != null)
            details.push(t('system.dashboard.storage.usedPercent', { percent: s.used_percent }));
          if (s.available_bytes != null)
            details.push(t('system.dashboard.storage.freeBytes', { bytes: formatBytes(s.available_bytes) }));
          if (s.total_bytes != null)
            details.push(t('system.dashboard.storage.totalBytes', { bytes: formatBytes(s.total_bytes) }));
          if (svc.error) details.push(svc.error);
          return details.length > 0 ? (
            <Box
              component="span"
              sx={{ fontSize: 12, color: svc.error ? 'var(--err)' : 'var(--on-surface-variant)' }}
            >
              {details.join(' • ')}
            </Box>
          ) : (
            '—'
          );
        }
        return svc.error ? (
          <Box component="span" sx={{ color: 'var(--err)', fontSize: 12 }}>
            {svc.error}
          </Box>
        ) : (
          '—'
        );
      },
    },
  ];

  const storageColumns: DataTableV2Column<SiteStorageSummary>[] = [
    {
      key: 'site',
      label: t('common.table.name', 'Site'),
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 500 }}>{row.site_name}</Box>
      ),
    },
    {
      key: 'used',
      label: t('common.table.used', 'Used'),
      width: '100px',
      muted: true,
      render: (row) => formatBytes(row.total_bytes),
    },
    {
      key: 'quota',
      label: t('siteSettings.storage.quota'),
      width: '100px',
      muted: true,
      render: (row) => formatBytes(row.quota_bytes),
    },
    {
      key: 'usage',
      label: t('common.table.usage', 'Usage'),
      width: 'minmax(200px, 2fr)',
      render: (row) => {
        const pct = Math.min(row.usage_percent, 100);
        const bar =
          pct >= 90 ? 'var(--err)' : pct >= 70 ? 'var(--on-warn-container)' : 'var(--primary)';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                bgcolor: 'var(--surface-container-high)',
                '& .MuiLinearProgress-bar': { bgcolor: bar, borderRadius: 999 },
              }}
            />
            <Box
              component="span"
              sx={{ minWidth: 42, textAlign: 'right', fontSize: 11, color: 'var(--on-surface-variant)' }}
            >
              {row.usage_percent.toFixed(1)}%
            </Box>
          </Box>
        );
      },
    },
  ];

  return (
    <Grid container spacing={3} data-testid="system.dashboard">
      {/* Sites total */}
      <Grid size={{ xs: 12, md: 4 }}>
        <DashboardCard icon="web" title={t('system.dashboard.sites')}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Box
              component="span"
              sx={{
                fontSize: 40,
                fontWeight: 700,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 700, "opsz" 40',
                letterSpacing: -0.5,
              }}
            >
              {sites?.length ?? 0}
            </Box>
            <Box component="span" sx={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              {t('system.dashboard.sitesLabel', { count: sites?.length ?? 0 })}
            </Box>
          </Box>
        </DashboardCard>
      </Grid>

      {/* Health summary */}
      <Grid size={{ xs: 12, md: 8 }}>
        <DashboardCard
          icon={statusCfg?.icon ?? 'error'}
          title={t('system.dashboard.health')}
          tone={statusTone}
        >
          {healthError ? (
            <Alert severity="error" sx={{ borderRadius: '12px' }}>
              {t('common.errors.serverUnreachable')}
            </Alert>
          ) : health ? (
            <Box
              sx={{
                p: 2,
                borderRadius: '14px',
                bgcolor: 'var(--surface-container-high)',
                border: '1px solid var(--outline-variant)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="span"
                  sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--on-surface)',
                    textTransform: 'capitalize',
                    fontVariationSettings: '"wght" 600, "opsz" 14',
                  }}
                >
                  {t(statusCfg!.labelKey)}
                </Box>
                {health.version && <StatusPill label={`v${health.version}`} tone="neutral" />}
              </Box>
              <Box
                component="span"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  fontSize: 12,
                  color: 'var(--on-surface-variant)',
                }}
              >
                {t('system.dashboard.servicesMonitored', { count: health.services.length })}
              </Box>
            </Box>
          ) : null}
        </DashboardCard>
      </Grid>

      {/* Service health table */}
      <Grid size={12}>
        <DashboardCard
          icon="dns"
          title={t('settings.systemInfo.serverHealth')}
          action={
            <M3IconButton
              name="refresh"
              size={36}
              tooltip={t('common.actions.refresh')}
              disabled={healthLoading}
              onClick={() => refetchHealth()}
            />
          }
        >
          {healthError ? (
            <Alert severity="error" sx={{ borderRadius: '12px' }}>
              {t('common.errors.serverUnreachable')}
            </Alert>
          ) : health ? (
            <>
              <DataTableV2<ServiceRow>
                columns={serviceColumns}
                rows={serviceRows}
                getKey={(svc) => svc.name}
                emptyMessage="—"
                data-testid="system.dashboard.services"
              />
              <Box
                component="span"
                sx={{
                  display: 'block',
                  mt: 1.5,
                  fontSize: 11,
                  color: 'var(--on-surface-variant)',
                }}
              >
                {t('settings.systemInfo.autoRefresh')}
              </Box>
            </>
          ) : null}
        </DashboardCard>
      </Grid>

      {/* Storage Overview */}
      {storageOverview && (
        <Grid size={12}>
          <DashboardCard icon="cloud" title={t('siteSettings.storage.systemOverview')}>
            <Box sx={{ mb: 3 }} data-testid="system.storage-overview">
              <Box
                component="span"
                sx={{ display: 'block', mb: 0.5, fontSize: 13, color: 'var(--on-surface-variant)' }}
              >
                {t('siteSettings.storage.usage', {
                  used: formatBytes(storageOverview.total_bytes),
                  total: formatBytes(storageOverview.total_quota_bytes),
                })}
              </Box>
              <LinearProgress
                variant="determinate"
                value={
                  storageOverview.total_quota_bytes > 0
                    ? Math.min(
                        (storageOverview.total_bytes / storageOverview.total_quota_bytes) * 100,
                        100,
                      )
                    : 0
                }
                sx={{
                  height: 8,
                  borderRadius: 999,
                  bgcolor: 'var(--surface-container-high)',
                  '& .MuiLinearProgress-bar': { bgcolor: 'var(--primary)', borderRadius: 999 },
                }}
                data-testid="system.storage-bar"
              />
            </Box>

            <DataTableV2<SiteStorageSummary>
              columns={storageColumns}
              rows={storageOverview.sites}
              getKey={(row) => row.site_id}
              emptyMessage="—"
              data-testid="system.dashboard.storage-sites"
            />
          </DashboardCard>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <GlobalCacheSection />
      </Grid>
    </Grid>
  );
}
