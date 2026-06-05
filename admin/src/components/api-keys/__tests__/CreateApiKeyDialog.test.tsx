import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';
import CreateApiKeyDialog from '../CreateApiKeyDialog';

const SITE_ID = '550e8400-e29b-41d4-a716-446655440000';

function setup(onSubmit = vi.fn().mockResolvedValue({})) {
  renderWithProviders(
    <CreateApiKeyDialog open siteId={SITE_ID} onSubmit={onSubmit} onClose={vi.fn()} />,
  );
  return onSubmit;
}

describe('CreateApiKeyDialog', () => {
  it('exposes the enforced quota fields and no site picker', () => {
    setup();
    expect(screen.getByTestId('field-quota-hourly')).toBeInTheDocument();
    expect(screen.getByTestId('field-quota-daily')).toBeInTheDocument();
    expect(screen.getByTestId('field-quota-monthly')).toBeInTheDocument();
    // Site is taken from the current context — the form must not ask for it.
    expect(screen.queryByLabelText(/^Site$/)).not.toBeInTheDocument();
  });

  it('submits the quota values plus the injected site_id (not the dead rate_limit fields)', async () => {
    const onSubmit = setup();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Public site key');
    await user.click(screen.getByTestId('create-api-key.btn.submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      site_id: SITE_ID,
      permission: 'Read',
      quota_hourly: 1000,
      quota_daily: 10000,
      quota_monthly: 100000,
    });
    expect(payload).not.toHaveProperty('rate_limit_per_hour');
  });

  it('sends the edited hourly quota', async () => {
    const onSubmit = setup();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Key');
    const hourly = within(screen.getByTestId('field-quota-hourly')).getByRole('spinbutton');
    await user.clear(hourly);
    await user.type(hourly, '100000');
    await user.click(screen.getByTestId('create-api-key.btn.submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ quota_hourly: 100000 });
  });
});
