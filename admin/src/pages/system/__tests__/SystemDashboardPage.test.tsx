import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/test-utils';
import { getHealth } from '@/services/health';
import { getSystemStorageOverview } from '@/services/sites';
import type { HealthResponse, SystemStorageOverviewResponse } from '@/types/api';
import SystemDashboardPage from '../SystemDashboardPage';

// The cache card has its own data + tests; keep this suite on the dashboard.
vi.mock('@/components/cache/GlobalCacheSection', () => ({ default: () => null }));

const health = {
  status: 'degraded',
  version: '2.1.5',
  services: [
    { name: 'Database', status: 'up', latency_ms: 4 },
    { name: 'Redis (Cache)', status: 'down', error: 'connection refused' },
  ],
  storage: { name: 'Storage (S3)', status: 'up', bucket: 'media' },
} as HealthResponse;

const storage = {
  total_bytes: 1024,
  total_quota_bytes: 4096,
  sites: [
    { site_id: 's-1', site_name: 'Alpha', total_bytes: 1024, quota_bytes: 2048, usage_percent: 50 },
  ],
} as SystemStorageOverviewResponse;

describe('SystemDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(getHealth).mockResolvedValue(health);
    vi.mocked(getSystemStorageOverview).mockResolvedValue(storage);
  });

  it('summarises health and lists every service plus the storage backend', async () => {
    renderWithProviders(<SystemDashboardPage />);

    expect(await screen.findByTestId('system.dashboard')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('v2.1.5')).toBeInTheDocument();
    expect(screen.getByText('2 services monitored')).toBeInTheDocument();

    const services = screen.getByTestId('system.dashboard.services');
    expect(within(services).getByText('Database')).toBeInTheDocument();
    expect(within(services).getByText('4 ms')).toBeInTheDocument();
    expect(within(services).getByText('Cache')).toBeInTheDocument();
    expect(within(services).getByText('connection refused')).toBeInTheDocument();
    expect(within(services).getByText('Storage')).toBeInTheDocument();
    expect(within(services).getByText('Bucket: media')).toBeInTheDocument();
  });

  it('shows instance-wide storage use against the combined quota', async () => {
    renderWithProviders(<SystemDashboardPage />);

    const bar = await screen.findByTestId('system.storage-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(within(screen.getByTestId('system.dashboard.storage-sites')).getByText('Alpha')).toBeInTheDocument();
  });

  it('reports an unreachable server in both health cards', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('offline'));
    renderWithProviders(<SystemDashboardPage />);

    expect(await screen.findAllByText('Server unreachable')).toHaveLength(2);
    expect(screen.queryByTestId('system.dashboard.services')).toBeNull();
  });
});
