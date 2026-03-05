import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useThemeMode } from '@/theme/ThemeContext';
import apiService from '@/services/api';
import type { UserPreferencesResponse, UpdateUserPreferencesRequest } from '@/types/api';
import type { ThemeId } from '@/theme/createAppTheme';

const DEFAULT_PREFERENCES: UserPreferencesResponse = {
  autosave_enabled: true,
  autosave_debounce_seconds: 3,
  language: localStorage.getItem('admin-language') || 'en',
  theme_id: localStorage.getItem('theme-preference') || 'system',
};

interface UserPreferencesContextValue {
  preferences: UserPreferencesResponse;
  isLoading: boolean;
  updatePreferences: (data: UpdateUserPreferencesRequest) => Promise<void>;
  isUpdating: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { clerkUserId } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const { setThemeId } = useThemeMode();

  const { data, isLoading } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => apiService.getUserPreferences(),
    enabled: !!clerkUserId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Sync loaded preferences → i18n language + theme
  useEffect(() => {
    if (!data) return;

    if (data.language && data.language !== i18n.language) {
      i18n.changeLanguage(data.language);
      try { localStorage.setItem('admin-language', data.language); } catch { /* noop */ }
    }

    if (data.theme_id) {
      setThemeId(data.theme_id as ThemeId);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (req: UpdateUserPreferencesRequest) => apiService.updateUserPreferences(req),
    onSuccess: (updated) => {
      queryClient.setQueryData(['userPreferences'], updated);
    },
  });

  const updatePreferences = useCallback(
    async (req: UpdateUserPreferencesRequest) => {
      // Sync language/theme immediately (don't wait for API round-trip)
      if (req.language) {
        i18n.changeLanguage(req.language);
        try { localStorage.setItem('admin-language', req.language); } catch { /* noop */ }
      }
      if (req.theme_id) {
        setThemeId(req.theme_id as ThemeId);
      }

      // Optimistic update
      const previous = queryClient.getQueryData<UserPreferencesResponse>(['userPreferences']);
      if (previous) {
        queryClient.setQueryData(['userPreferences'], {
          ...previous,
          ...Object.fromEntries(
            Object.entries(req).filter(([, v]) => v !== undefined),
          ),
        });
      }
      try {
        await mutation.mutateAsync(req);
      } catch {
        // Revert on error
        if (previous) {
          queryClient.setQueryData(['userPreferences'], previous);
          // Revert i18n/theme too
          if (req.language) {
            i18n.changeLanguage(previous.language);
            try { localStorage.setItem('admin-language', previous.language); } catch { /* noop */ }
          }
          if (req.theme_id) {
            setThemeId(previous.theme_id as ThemeId);
          }
        }
      }
    },
    [mutation, queryClient, i18n, setThemeId],
  );

  const value: UserPreferencesContextValue = {
    preferences: data ?? DEFAULT_PREFERENCES,
    isLoading,
    updatePreferences,
    isUpdating: mutation.isPending,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  return ctx;
}
