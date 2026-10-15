import { Box, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DataTableV2, type DataTableV2Column } from '@/components/shared/listPageV2';
import type { SiteStorageSummary, SystemStorageOverviewResponse } from '@/types/api';
import DashboardCard from './DashboardCard';
import { formatBytes } from '@/utils/formatBytes';
import { quotaUsagePercent, usageBarColor } from './systemDashboardFormat';

function SiteUsageBar({ percent }: { percent: number }) {
  const pct = Math.min(percent, 100);
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
          '& .MuiLinearProgress-bar': { bgcolor: usageBarColor(pct), borderRadius: 999 },
        }}
      />
      <Box
        component="span"
        sx={{ minWidth: 42, textAlign: 'right', fontSize: 11, color: 'var(--on-surface-variant)' }}
      >
        {percent.toFixed(1)}%
      </Box>
    </Box>
  );
}

function useStorageColumns(): DataTableV2Column<SiteStorageSummary>[] {
  const { t } = useTranslation();
  return [
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
      render: (row) => <SiteUsageBar percent={row.usage_percent} />,
    },
  ];
}

/** Instance-wide storage use against the combined quota, broken down per site. */
export default function StorageOverviewCard({ overview }: { overview: SystemStorageOverviewResponse }) {
  const { t } = useTranslation();
  const columns = useStorageColumns();

  return (
    <DashboardCard icon="cloud" title={t('siteSettings.storage.systemOverview')}>
      <Box sx={{ mb: 3 }} data-testid="system.storage-overview">
        <Box
          component="span"
          sx={{ display: 'block', mb: 0.5, fontSize: 13, color: 'var(--on-surface-variant)' }}
        >
          {t('siteSettings.storage.usage', {
            used: formatBytes(overview.total_bytes),
            total: formatBytes(overview.total_quota_bytes),
          })}
        </Box>
        <LinearProgress
          variant="determinate"
          value={quotaUsagePercent(overview.total_bytes, overview.total_quota_bytes)}
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
        columns={columns}
        rows={overview.sites}
        getKey={(row) => row.site_id}
        emptyMessage="—"
        data-testid="system.dashboard.storage-sites"
      />
    </DashboardCard>
  );
}
