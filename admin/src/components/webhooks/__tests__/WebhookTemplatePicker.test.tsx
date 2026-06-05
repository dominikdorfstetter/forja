import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import WebhookTemplatePicker from '../WebhookTemplatePicker';
import { WEBHOOK_TEMPLATES } from '@/data/webhookTemplates';

describe('WebhookTemplatePicker', () => {
  it('renders all template cards plus custom', () => {
    renderWithProviders(
      <WebhookTemplatePicker onSelect={vi.fn()} selected={null} />,
    );
    const radiogroup = screen.getByRole('radiogroup');
    expect(radiogroup).toBeInTheDocument();

    // Each template + custom card
    for (const template of WEBHOOK_TEMPLATES) {
      expect(screen.getByTestId(`template-card-${template.id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('template-card-custom')).toBeInTheDocument();
  });

  it('highlights selected template', () => {
    renderWithProviders(
      <WebhookTemplatePicker onSelect={vi.fn()} selected="vercel" />,
    );
    const vercelCard = screen.getByTestId('template-card-vercel');
    expect(vercelCard).toHaveAttribute('aria-checked', 'true');

    const netlifyCard = screen.getByTestId('template-card-netlify');
    expect(netlifyCard).toHaveAttribute('aria-checked', 'false');

    const customCard = screen.getByTestId('template-card-custom');
    expect(customCard).toHaveAttribute('aria-checked', 'false');
  });

  it('highlights custom when selected is null', () => {
    renderWithProviders(
      <WebhookTemplatePicker onSelect={vi.fn()} selected={null} />,
    );
    const customCard = screen.getByTestId('template-card-custom');
    expect(customCard).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onSelect with template when a template card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <WebhookTemplatePicker onSelect={onSelect} selected={null} />,
    );
    const vercelCard = screen.getByTestId('template-card-vercel');
    // Click the button inside the card (CardActionArea renders as a button)
    const button = vercelCard.querySelector('button');
    expect(button).toBeTruthy();
    await user.click(button!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vercel', provider: 'vercel' }),
    );
  });

  it('calls onSelect with null when custom card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <WebhookTemplatePicker onSelect={onSelect} selected="vercel" />,
    );
    const customCard = screen.getByTestId('template-card-custom');
    const button = customCard.querySelector('button');
    expect(button).toBeTruthy();
    await user.click(button!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
