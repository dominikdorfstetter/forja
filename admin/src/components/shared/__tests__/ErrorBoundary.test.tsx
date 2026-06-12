import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import ErrorBoundary from '../ErrorBoundary';

// Controls whether the child throws; mutated mid-test so a reset can recover.
const throwState = { shouldThrow: true };

function Boom() {
  if (throwState.shouldThrow) throw new Error('Kaboom');
  return <div>healthy content</div>;
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  throwState.shouldThrow = true;
  // React logs caught render errors; keep test output clean.
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children while nothing throws', () => {
    throwState.shouldThrow = false;
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy content')).toBeInTheDocument();
  });

  it('shows the error fallback when a child throws during render', () => {
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('healthy content')).not.toBeInTheDocument();
  });

  it('recovers via the fallback "Try again" once the underlying problem is gone', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    throwState.shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('healthy content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders a custom fallback with the thrown error and a working reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>custom fallback: {error?.message}</span>
            <button onClick={reset}>recover</button>
          </div>
        )}
      >
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback: Kaboom')).toBeInTheDocument();

    throwState.shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'recover' }));
    expect(screen.getByText('healthy content')).toBeInTheDocument();
  });
});
