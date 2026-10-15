import type { ReactNode } from 'react';
import { Alert, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DataTableV2 } from '@/components/shared/listPageV2';
import { M3IconButton } from '@/components/design-system';
import type { HealthResponse } from '@/types/api';
import DashboardCard from './DashboardCard';
import StatusPill from './StatusPill';
import { useServiceHealthColumns } from './useServiceHealthColumns';
import { buildServiceRows, healthStatusConfig, type ServiceRow } from './systemDashboardFormat';

interface HealthState {
  health: HealthResponse | undefined;
  error: Error | null;
}

/** Shared body states of the health cards: unreachable server → alert, no data yet → nothing. */
function HealthGate({
  health,
  error,
  children,
}: HealthState & { children: (health: HealthResponse) => ReactNode }) {
  const { t } = useTranslation();
  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: '12px' }}>
        {t('common.errors.serverUnreachable')}
      </Alert>
    );
  }
  return health ? children(health) : null;
}

/** Overall status (healthy / degraded / unhealthy), API version and monitored-service count. */
export function HealthSummaryCard({ health, error }: HealthState) {
  const { t } = useTranslation();
  const statusCfg = health ? healthStatusConfig(health.status) : undefined;

  return (
    <DashboardCard
      icon={statusCfg?.icon ?? 'error'}
      title={t('system.dashboard.health')}
      tone={statusCfg?.tone ?? 'err'}
    >
      <HealthGate health={health} error={error}>
        {(h) => (
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
              {h.version && <StatusPill label={`v${h.version}`} tone="neutral" />}
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
              {t('system.dashboard.servicesMonitored', { count: h.services.length })}
            </Box>
          </Box>
        )}
      </HealthGate>
    </DashboardCard>
  );
}

/** Per-service health table (incl. the storage backend) with a manual refresh. */
export function ServiceHealthCard({
  health,
  error,
  refreshing,
  onRefresh,
}: HealthState & { refreshing: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();
  const columns = useServiceHealthColumns();

  return (
    <DashboardCard
      icon="dns"
      title={t('settings.systemInfo.serverHealth')}
      action={
        <M3IconButton
          name="refresh"
          size={36}
          tooltip={t('common.actions.refresh')}
          disabled={refreshing}
          onClick={onRefresh}
        />
      }
    >
      <HealthGate health={health} error={error}>
        {(h) => (
          <>
            <DataTableV2<ServiceRow>
              columns={columns}
              rows={buildServiceRows(h)}
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
        )}
      </HealthGate>
    </DashboardCard>
  );
}
