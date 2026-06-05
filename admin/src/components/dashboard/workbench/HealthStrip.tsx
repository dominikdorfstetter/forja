import { useTranslation } from 'react-i18next';
import { Icon, STATUS_META } from '@/components/design-system';
import type { HealthResponse } from '@/types/api';

export interface HealthStripProps {
  healthData: HealthResponse | undefined;
  loading: boolean;
}

/**
 * Ambient system-health strip shown below the Workbench feed. Green
 * pulsing dot when all services are healthy; red otherwise. The pulse
 * animation respects prefers-reduced-motion via the global foundation
 * override.
 */
export function HealthStrip({ healthData, loading }: HealthStripProps) {
  const { t } = useTranslation();
  const healthy = !loading && healthData?.status === 'healthy';
  const dotColor = healthy ? STATUS_META.Published.dot : 'var(--err)';
  const label = healthy
    ? t('dashboard.workbench.health.healthy', 'All systems healthy')
    : loading
      ? t('dashboard.workbench.health.checking', 'Checking services…')
      : t('dashboard.workbench.health.degraded', 'Service degraded');

  const services = (healthData?.services ?? [])
    .filter((s) => s.status !== 'disabled')
    .map((s) => s.name.charAt(0).toUpperCase() + s.name.slice(1));
  const version = healthData?.version ? `v${healthData.version}` : '';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '16px 20px',
        borderRadius: 20,
        background: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 0 4px ${dotColor}33`,
          animation: healthy ? 'pulse 2s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
          {services.length > 0
            ? services.join(' · ')
            : t('dashboard.workbench.health.noServices', 'No services reported')}
        </div>
      </div>
      {version && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--on-surface-variant)',
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name="deployed_code" size={12} />
          {version}
        </span>
      )}
    </div>
  );
}
