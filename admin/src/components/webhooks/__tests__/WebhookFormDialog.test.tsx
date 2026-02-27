import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import WebhookFormDialog from '../WebhookFormDialog';
import type { Webhook } from '@/types/api';

const existingWebhook: Webhook = {
  id: 'wh-1',
  site_id: 'site-1',
  url: 'https://example.com/hook',
  description: 'My webhook',
  events: ['blog.created'],
  is_active: true,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

describe('WebhookFormDialog', () => {
  it('renders create mode title and empty fields', () => {
    renderWithProviders(
      <WebhookFormDialog open onClose={vi.fn()} onSubmitCreate={vi.fn()} />,
    );
    // The dialog should show the create title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // URL field should be empty
    const urlInput = screen.getByRole('textbox', { name: /url/i });
    expect(urlInput).toHaveValue('');
  });

  it('renders edit mode with pre-filled fields', () => {
    renderWithProviders(
      <WebhookFormDialog
        open
        webhook={existingWebhook}
        onClose={vi.fn()}
        onSubmitUpdate={vi.fn()}
      />,
    );
    const urlInput = screen.getByRole('textbox', { name: /url/i });
    expect(urlInput).toHaveValue('https://example.com/hook');
  });

  it('submit button disabled for invalid URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WebhookFormDialog open onClose={vi.fn()} onSubmitCreate={vi.fn()} />,
    );
    const urlInput = screen.getByRole('textbox', { name: /url/i });
    await user.type(urlInput, 'not-a-url');
    await waitFor(() => {
      const submitBtn = screen.getAllByRole('button').find(
        (b) => b.classList.contains('MuiButton-contained'),
      );
      expect(submitBtn).toBeDisabled();
    });
  });

  it('calls onSubmitCreate with correct data', async () => {
    const user = userEvent.setup();
    const onSubmitCreate = vi.fn();
    renderWithProviders(
      <WebhookFormDialog open onClose={vi.fn()} onSubmitCreate={onSubmitCreate} />,
    );
    const urlInput = screen.getByRole('textbox', { name: /url/i });
    await user.type(urlInput, 'https://valid.com/webhook');
    await waitFor(() => {
      const submitBtn = screen.getAllByRole('button').find(
        (b) => b.classList.contains('MuiButton-contained'),
      );
      expect(submitBtn).not.toBeDisabled();
    });
    const submitBtn = screen.getAllByRole('button').find(
      (b) => b.classList.contains('MuiButton-contained'),
    )!;
    await user.click(submitBtn);
    await waitFor(() => {
      expect(onSubmitCreate).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://valid.com/webhook' }),
      );
    });
  });

  it('disabled submit while loading', () => {
    renderWithProviders(
      <WebhookFormDialog open onClose={vi.fn()} onSubmitCreate={vi.fn()} loading />,
    );
    const submitBtn = screen.getAllByRole('button').find(
      (b) => b.classList.contains('MuiButton-contained'),
    );
    expect(submitBtn).toBeDisabled();
  });

  it('is not visible when closed', () => {
    renderWithProviders(
      <WebhookFormDialog open={false} onClose={vi.fn()} onSubmitCreate={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
