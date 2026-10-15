import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import StatusPill from './StatusPill';
import { serviceDisplayName, storageServiceDetails, type ServiceRow } from './systemDashboardFormat';

function ServiceDetails({ svc }: { svc: ServiceRow }) {
  const { t } = useTranslation();
  if (svc._kind === 'storage') {
    const details = storageServiceDetails(svc, t);
    if (details.length === 0) return '—';
    return (
      <Box
        component="span"
        sx={{ fontSize: 12, color: svc.error ? 'var(--err)' : 'var(--on-surface-variant)' }}
      >
        {details.join(' • ')}
      </Box>
    );
  }
  if (!svc.error) return '—';
  return (
    <Box component="span" sx={{ color: 'var(--err)', fontSize: 12 }}>
      {svc.error}
    </Box>
  );
}

/** Columns of the service-health table: friendly name, up/down pill, latency, details. */
export function useServiceHealthColumns(): DataTableV2Column<ServiceRow>[] {
  const { t } = useTranslation();
  return [
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
      render: (svc) => <ServiceDetails svc={svc} />,
    },
  ];
}
