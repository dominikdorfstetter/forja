import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type { HealthResponse } from '@/types/api';
import {
  buildServiceRows,
  healthStatusConfig,
  quotaUsagePercent,
  serviceDisplayName,
  storageServiceDetails,
  usageBarColor,
} from '../systemDashboardFormat';

// Echo the key plus interpolation values so assertions can see what was asked for.
const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key) as unknown as TFunction;

describe('serviceDisplayName', () => {
  it('maps implementation names to capability labels', () => {
    expect(serviceDisplayName('Database', t)).toBe('system.dashboard.services.database');
    expect(serviceDisplayName('Redis (Cache)', t)).toBe('system.dashboard.services.cache');
    expect(serviceDisplayName('Clerk (IdP)', t)).toBe('system.dashboard.services.idp');
    expect(serviceDisplayName('Storage (Local)', t)).toBe('system.dashboard.services.storage');
  });

  it('passes unknown service names through', () => {
    expect(serviceDisplayName('Mailer', t)).toBe('Mailer');
  });
});

describe('healthStatusConfig', () => {
  it('resolves known statuses and returns undefined for unknown ones', () => {
    expect(healthStatusConfig('degraded')?.tone).toBe('warn');
    expect(healthStatusConfig('exploded')).toBeUndefined();
  });
});

describe('buildServiceRows', () => {
  const db = { name: 'Database', status: 'up', latency_ms: 3 };

  it('is empty without a health response', () => {
    expect(buildServiceRows(undefined)).toEqual([]);
  });

  it('appends the storage backend as a tagged row when reported', () => {
    const health = {
      status: 'healthy',
      services: [db],
      storage: { name: 'Storage (S3)', status: 'up', bucket: 'media' },
    } as HealthResponse;
    expect(buildServiceRows(health)).toEqual([
      db,
      { name: 'Storage (S3)', status: 'up', bucket: 'media', _kind: 'storage' },
    ]);
  });

  it('lists only the services when no storage is reported', () => {
    expect(buildServiceRows({ status: 'healthy', services: [db] } as HealthResponse)).toEqual([db]);
  });
});

describe('storageServiceDetails', () => {
  it('lists the reported fragments in display order', () => {
    const row = {
      name: 'Storage',
      status: 'down',
      bucket: 'media',
      used_percent: 42,
      available_bytes: 1024,
      total_bytes: 2048,
      error: 'Disk read error',
    };
    expect(storageServiceDetails(row, t)).toEqual([
      'system.dashboard.storage.bucket:{"name":"media"}',
      'system.dashboard.storage.usedPercent:{"percent":42}',
      'system.dashboard.storage.freeBytes:{"bytes":"1.0 KB"}',
      'system.dashboard.storage.totalBytes:{"bytes":"2.0 KB"}',
      'Disk read error',
    ]);
  });

  it('keeps zero values but skips absent ones', () => {
    const row = { name: 'Storage', status: 'up', used_percent: 0 };
    expect(storageServiceDetails(row, t)).toEqual([
      'system.dashboard.storage.usedPercent:{"percent":0}',
    ]);
  });
});

describe('usage percentages', () => {
  it('colours the bar by threshold', () => {
    expect(usageBarColor(95)).toBe('var(--err)');
    expect(usageBarColor(70)).toBe('var(--on-warn-container)');
    expect(usageBarColor(69.9)).toBe('var(--primary)');
  });

  it('caps quota usage at 100 and treats a missing quota as 0', () => {
    expect(quotaUsagePercent(50, 200)).toBe(25);
    expect(quotaUsagePercent(500, 200)).toBe(100);
    expect(quotaUsagePercent(500, 0)).toBe(0);
  });
});
