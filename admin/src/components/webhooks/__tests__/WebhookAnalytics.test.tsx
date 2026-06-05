import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getWebhookStats } from '@/services/webhooks';
import WebhookAnalytics from '../WebhookAnalytics';
import type { WebhookStatsResponse } from '@/types/api';

const mockStats: WebhookStatsResponse = {
  webhook_id: 'wh-1',
  window: '24h',
  total_deliveries: 150,
  successful: 142,
  failed: 8,
  pending_retry: 3,
  success_rate: 94.7,
  by_event: [
    { event_type: 'blog.created', total: 80, successful: 78, failed: 2 },
    { event_type: 'blog.updated', total: 70, successful: 64, failed: 6 },
  ],
};

describe('WebhookAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWebhookStats).mockResolvedValue(mockStats);
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <WebhookAnalytics open={false} webhookId="wh-1" onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId('webhook-analytics.dialog')).not.toBeInTheDocument();
  });

  it('renders summary cards with stats', async () => {
    renderWithProviders(
      <WebhookAnalytics open webhookId="wh-1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });
    expect(screen.getByText('94.7%')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders per-event breakdown table', async () => {
    renderWithProviders(
      <WebhookAnalytics open webhookId="wh-1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('blog.created')).toBeInTheDocument();
    });
    expect(screen.getByText('blog.updated')).toBeInTheDocument();
    // Check values in the table
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('changes time window when toggle button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WebhookAnalytics open webhookId="wh-1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    // Click the 7d button
    const sevenDayBtn = screen.getByRole('button', { name: /7 days/i });
    await user.click(sevenDayBtn);

    await waitFor(() => {
      expect(getWebhookStats).toHaveBeenCalledWith('wh-1', '7d');
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <WebhookAnalytics open webhookId="wh-1" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // Two close affordances after the M3 migration: the top-right X icon
    // in the FormDialog header and the explicit footer "Close" button.
    // Either should fire onClose.
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state while fetching', () => {
    vi.mocked(getWebhookStats).mockReturnValue(new Promise(() => {}));
    renderWithProviders(
      <WebhookAnalytics open webhookId="wh-1" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
