import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import DateRangeBar from '../DateRangeBar';
import type { DateRangeValue } from '../DateRangeBar';

describe('DateRangeBar', () => {
  const defaultValue: DateRangeValue = { preset: '30d' };
  const onChange = vi.fn();

  it('renders preset chips', () => {
    renderWithProviders(
      <DateRangeBar value={defaultValue} onChange={onChange} />,
    );

    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('calls onChange with correct preset when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DateRangeBar value={defaultValue} onChange={onChange} />,
    );

    await user.click(screen.getByText('7 days'));
    expect(onChange).toHaveBeenCalledWith({ preset: '7d' });
  });

  it('marks the active preset with aria-pressed', () => {
    renderWithProviders(
      <DateRangeBar value={defaultValue} onChange={onChange} />,
    );

    const active = screen.getByText('30 days').closest('[aria-pressed]');
    expect(active).toHaveAttribute('aria-pressed', 'true');

    const inactive = screen.getByText('7 days').closest('[aria-pressed]');
    expect(inactive).toHaveAttribute('aria-pressed', 'false');
  });
});
