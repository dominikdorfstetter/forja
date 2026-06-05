import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';
import EditApiKeyDialog from '../EditApiKeyDialog';
import type { ApiKeyListItem } from '@/types/api';

const SITE_ID = '550e8400-e29b-41d4-a716-446655440000';

const apiKey: ApiKeyListItem = {
  id: 'key-1',
  name: 'My read key',
  key_prefix: 'dk_live_a1b2',
  permission: 'Read',
  status: 'Active',
  site_id: SITE_ID,
  quota_hourly: 5000,
  quota_daily: 50000,
  quota_monthly: 500000,
  total_requests: 0,
  created_at: '2026-05-22T00:00:00Z',
};

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  renderWithProviders(
    <EditApiKeyDialog open apiKey={apiKey} onSubmit={onSubmit} onClose={vi.fn()} />,
  );
  return onSubmit;
}

describe('EditApiKeyDialog', () => {
  it('prefills the form with the key\'s current quotas', () => {
    setup();
    expect(within(screen.getByTestId('field-quota-hourly')).getByRole('spinbutton')).toHaveValue(5000);
    expect(within(screen.getByTestId('field-quota-daily')).getByRole('spinbutton')).toHaveValue(50000);
    expect(within(screen.getByTestId('field-quota-monthly')).getByRole('spinbutton')).toHaveValue(500000);
  });

  it('submits the updated hourly quota with the key id', async () => {
    const onSubmit = setup();
    const user = userEvent.setup();

    const hourly = within(screen.getByTestId('field-quota-hourly')).getByRole('spinbutton');
    await user.clear(hourly);
    await user.type(hourly, '100000');
    await user.click(screen.getByTestId('edit-api-key.btn.submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      'key-1',
      expect.objectContaining({ name: 'My read key', quota_hourly: 100000 }),
    );
  });
});
