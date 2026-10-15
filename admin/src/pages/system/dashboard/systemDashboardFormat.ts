import type { TFunction } from 'i18next';
import type { HealthResponse } from '@/types/api';
import { formatBytes } from '@/utils/formatBytes';

export type HealthService = HealthResponse['services'][number];

/** A health-table row; the storage backend rides along as an extra `_kind: 'storage'` row. */
export type ServiceRow = HealthService & { _kind?: 'storage' };

type StorageServiceRow = ServiceRow & {
  bucket?: string;
  used_percent?: number;
  available_bytes?: number;
  total_bytes?: number;
};

export const STATUS_CONFIG = {
  healthy: { icon: 'check_circle', tone: 'tertiary', labelKey: 'common.status.healthy' },
  degraded: { icon: 'warning', tone: 'warn', labelKey: 'common.status.degraded' },
  unhealthy: { icon: 'error', tone: 'err', labelKey: 'common.status.unhealthy' },
} as const;

export type HealthStatusConfig = (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];

/** Presentation of the overall health status; `undefined` for a status the UI doesn't know. */
export const healthStatusConfig = (status: string): HealthStatusConfig | undefined =>
  STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];

/**
 * Map the backend's implementation-specific service names (Database, Redis
 * (Cache), Clerk (IdP), Storage (Local)) to friendly, user-facing labels.
 * The user shouldn't care that caching runs on Redis or that identity is
 * provided by Clerk — they care which capability is reachable.
 */
export function serviceDisplayName(rawName: string, t: TFunction): string {
  const lower = rawName.toLowerCase();
  if (lower.includes('database') || lower.includes('datenbank')) return t('system.dashboard.services.database');
  if (lower.includes('cache') || lower.includes('redis')) return t('system.dashboard.services.cache');
  if (lower.includes('clerk') || lower.includes('idp')) return t('system.dashboard.services.idp');
  if (lower.includes('storage')) return t('system.dashboard.services.storage');
  return rawName;
}

/** Backend services plus the storage backend (when reported) as one table. */
export const buildServiceRows = (health: HealthResponse | undefined): ServiceRow[] => {
  if (!health) return [];
  return health.storage
    ? [...health.services, { ...health.storage, _kind: 'storage' }]
    : [...health.services];
};

/** Detail fragments of the storage row (bucket, usage, capacity, error), in display order. */
export function storageServiceDetails(row: ServiceRow, t: TFunction): string[] {
  const svc = row as StorageServiceRow;
  return [
    svc.bucket ? t('system.dashboard.storage.bucket', { name: svc.bucket }) : null,
    svc.used_percent != null
      ? t('system.dashboard.storage.usedPercent', { percent: svc.used_percent })
      : null,
    svc.available_bytes != null
      ? t('system.dashboard.storage.freeBytes', { bytes: formatBytes(svc.available_bytes) })
      : null,
    svc.total_bytes != null
      ? t('system.dashboard.storage.totalBytes', { bytes: formatBytes(svc.total_bytes) })
      : null,
    svc.error || null,
  ].filter((part): part is string => part !== null);
}

/** Usage-bar colour: error from 90 %, warning from 70 %, primary below. */
export function usageBarColor(percent: number): string {
  if (percent >= 90) return 'var(--err)';
  if (percent >= 70) return 'var(--on-warn-container)';
  return 'var(--primary)';
}

/** Share of the combined quota in use, capped at 100; 0 when no quota is configured. */
export const quotaUsagePercent = (usedBytes: number, quotaBytes: number): number =>
  quotaBytes > 0 ? Math.min((usedBytes / quotaBytes) * 100, 100) : 0;
