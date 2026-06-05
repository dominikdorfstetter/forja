import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeModeProvider, useThemeMode } from '@/theme/ThemeContext';
import { renderWithProviders } from '@/test/test-utils';
import PreferencesDrawer from '../PreferencesDrawer';

vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: {
      language: 'en',
      theme_id: 'm3Dark',
      page_size: 25,
    },
    updatePreferences: vi.fn(),
  }),
}));

// Harness that primes the theme context to m3Dark so the accent section renders
function Harness() {
  const theme = useThemeMode();
  // Ensure m3Dark resolved flavor on first render
  if (theme.themeId !== 'm3Dark') {
    act(() => theme.setThemeId('m3Dark'));
  }
  return <PreferencesDrawer open onClose={() => {}} />;
}

describe('PreferencesDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('theme-preference', 'm3Dark');
  });

  it('renders the accent picker when M3 Expressive Dark is active', async () => {
    renderWithProviders(
      <ThemeModeProvider>
        <Harness />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('preferences-accent-violet')).toBeInTheDocument();
      expect(screen.getByTestId('preferences-accent-coral')).toBeInTheDocument();
      expect(screen.getByTestId('preferences-accent-teal')).toBeInTheDocument();
      expect(screen.getByTestId('preferences-accent-amber')).toBeInTheDocument();
    });
  });

  it('persists the selected accent to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ThemeModeProvider>
        <Harness />
      </ThemeModeProvider>,
    );
    await user.click(await screen.findByTestId('preferences-accent-coral'));
    await waitFor(() => {
      expect(localStorage.getItem('forja:accent')).toBe('coral');
    });
  });

  it('persists density changes and reflects them on <html data-density>', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ThemeModeProvider>
        <Harness />
      </ThemeModeProvider>,
    );
    const compactBtn = await screen.findByRole('button', { name: /Compact/i });
    await user.click(compactBtn);
    await waitFor(() => {
      expect(localStorage.getItem('forja:density')).toBe('compact');
      expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    });
  });
});
