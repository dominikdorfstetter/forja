import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { getApiKeyUsageSummary } from '@/services/apiKeys';
import ApiKeyUsageDialog from '../ApiKeyUsageDialog';
import type { UsageSummaryResponse } from '@/types/api';

const mockSummary: UsageSummaryResponse = {
  quota: {
    hourly: { limit: 1000, used: 342, remaining: 658, resets_at: new Date(Date.now() + 1800_000).toISOString() },
    daily: { limit: 10000, used: 9200, remaining: 800, resets_at: new Date(Date.now() + 43200_000).toISOString() },
    monthly: { limit: 100000, used: 67230, remaining: 32770, resets_at: new Date(Date.now() + 864000_000).toISOString() },
  },
  history: {
    daily: [
      { date: '2026-03-22', total_requests: 5200, successful: 5100, failed: 100, rate_limit_hits: 12 },
      { date: '2026-03-21', total_requests: 4800, successful: 4750, failed: 50, rate_limit_hits: 3 },
    ],
  },
  totals: {
    all_time_requests: 245000,
    last_used_at: '2026-03-22T10:45:12Z',
  },
};

const defaultProps = {
  open: true,
  keyId: '550e8400-e29b-41d4-a716-446655440000',
  keyName: 'Test Key',
  onClose: vi.fn(),
};

describe('ApiKeyUsageDialog', () => {
  it('renders dialog with title', async () => {
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(mockSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);
    expect(await screen.findByText(/API Key Usage.*Test Key/)).toBeInTheDocument();
  });

  it('renders quota gauges with correct values', async () => {
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(mockSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('quota-gauges')).toBeInTheDocument();
    expect(screen.getByTestId('quota-gauge.hourly')).toBeInTheDocument();
    expect(screen.getByTestId('quota-gauge.daily')).toBeInTheDocument();
    expect(screen.getByTestId('quota-gauge.monthly')).toBeInTheDocument();
  });

  it('renders usage timeline chart', async () => {
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(mockSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('usage-timeline', {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 15_000);

  it('renders summary stats', async () => {
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(mockSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('usage-summary-stats')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats.all-time')).toHaveTextContent('245,000');
  });

  it('handles null quota gracefully (Redis down)', async () => {
    const noQuotaSummary: UsageSummaryResponse = {
      ...mockSummary,
      quota: { hourly: null, daily: null, monthly: null },
    };
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(noQuotaSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('quota-gauges')).toBeInTheDocument();
    // Should show "unavailable" text for each gauge
    const unavailableTexts = screen.getAllByText('Quota data unavailable');
    expect(unavailableTexts).toHaveLength(3);
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(getApiKeyUsageSummary).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('api-key-usage.error')).toBeInTheDocument();
  });

  it('does not fetch when dialog is closed', () => {
    vi.mocked(getApiKeyUsageSummary).mockClear();
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} open={false} />);

    expect(getApiKeyUsageSummary).not.toHaveBeenCalled();
  });

  it('renders close button', async () => {
    vi.mocked(getApiKeyUsageSummary).mockResolvedValue(mockSummary);
    renderWithProviders(<ApiKeyUsageDialog {...defaultProps} />);

    expect(await screen.findByTestId('api-key-usage.btn.close')).toBeInTheDocument();
  });
});
