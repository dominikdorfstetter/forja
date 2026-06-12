import { describe, it, expect, vi } from 'vitest';
import { Routes, Route } from 'react-router';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import ErrorFallback from '../ErrorFallback';

const boom = new Error('Kaboom');

describe('ErrorFallback', () => {
  it('shows the generic failure title and description', () => {
    renderWithProviders(<ErrorFallback error={boom} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred on this page.'),
    ).toBeInTheDocument();
  });

  it('reveals the error message behind a "Show details" toggle and hides it again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorFallback error={boom} />);

    await user.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText(/Kaboom/)).toBeInTheDocument();

    // Toggle flips to the hide label once details are open
    await user.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.getByRole('button', { name: 'Show details' })).toBeInTheDocument();
  });

  it('omits the details toggle when there is no error object', () => {
    renderWithProviders(<ErrorFallback error={null} />);
    expect(screen.queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
  });

  it('calls onReset when the user clicks "Try again"', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderWithProviders(<ErrorFallback error={boom} onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('hides "Try again" when no onReset is provided', () => {
    renderWithProviders(<ErrorFallback error={boom} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('navigates home via "Go to Dashboard" when the dashboard link is enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<div>dashboard home</div>} />
        <Route
          path="/broken"
          element={<ErrorFallback error={boom} showDashboardLink />}
        />
      </Routes>,
      { route: '/broken' },
    );

    await user.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(screen.getByText('dashboard home')).toBeInTheDocument();
  });

  it('hides the dashboard link by default', () => {
    renderWithProviders(<ErrorFallback error={boom} />);
    expect(
      screen.queryByRole('button', { name: 'Go to Dashboard' }),
    ).not.toBeInTheDocument();
  });
});
