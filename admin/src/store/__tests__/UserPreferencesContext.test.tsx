import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { UserPreferencesProvider, useUserPreferences } from '../UserPreferencesContext';
import apiService from '@/services/api';

// Mock AuthContext
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    clerkUserId: 'user_test123',
  }),
}));

// Mock ThemeContext
vi.mock('@/theme/ThemeContext', () => ({
  useThemeMode: () => ({
    themeId: 'system',
    setThemeId: vi.fn(),
    resolvedFlavor: 'latte',
    options: [],
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

const mockedApi = vi.mocked(apiService);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserPreferencesProvider>{children}</UserPreferencesProvider>
      </QueryClientProvider>
    );
  };
}

describe('UserPreferencesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default preferences while loading', () => {
    mockedApi.getUserPreferences.mockReturnValue(new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useUserPreferences(), { wrapper: createWrapper() });

    expect(result.current.preferences).toMatchObject({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
    });
    expect(result.current.preferences).toHaveProperty('language');
    expect(result.current.preferences).toHaveProperty('theme_id');
    expect(result.current.isLoading).toBe(true);
  });

  it('returns server values when loaded', async () => {
    mockedApi.getUserPreferences.mockResolvedValue({
      autosave_enabled: false,
      autosave_debounce_seconds: 10,
      language: 'de',
      theme_id: 'mocha',
    });

    const { result } = renderHook(() => useUserPreferences(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preferences).toEqual({
      autosave_enabled: false,
      autosave_debounce_seconds: 10,
      language: 'de',
      theme_id: 'mocha',
    });
  });

  it('calls API on updatePreferences', async () => {
    mockedApi.getUserPreferences.mockResolvedValue({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
      language: 'en',
      theme_id: 'system',
    });
    mockedApi.updateUserPreferences.mockResolvedValue({
      autosave_enabled: false,
      autosave_debounce_seconds: 3,
      language: 'en',
      theme_id: 'system',
    });

    const { result } = renderHook(() => useUserPreferences(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updatePreferences({ autosave_enabled: false });

    expect(mockedApi.updateUserPreferences).toHaveBeenCalledWith({ autosave_enabled: false });
  });

  it('persists language change via API', async () => {
    mockedApi.getUserPreferences.mockResolvedValue({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
      language: 'en',
      theme_id: 'system',
    });
    mockedApi.updateUserPreferences.mockResolvedValue({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
      language: 'de',
      theme_id: 'system',
    });

    const { result } = renderHook(() => useUserPreferences(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updatePreferences({ language: 'de' });

    expect(mockedApi.updateUserPreferences).toHaveBeenCalledWith({ language: 'de' });
  });

  it('persists theme change via API', async () => {
    mockedApi.getUserPreferences.mockResolvedValue({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
      language: 'en',
      theme_id: 'system',
    });
    mockedApi.updateUserPreferences.mockResolvedValue({
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
      language: 'en',
      theme_id: 'mocha',
    });

    const { result } = renderHook(() => useUserPreferences(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updatePreferences({ theme_id: 'mocha' });

    expect(mockedApi.updateUserPreferences).toHaveBeenCalledWith({ theme_id: 'mocha' });
  });
});
