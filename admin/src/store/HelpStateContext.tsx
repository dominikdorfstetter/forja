import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import apiService from '@/services/api';
import type { HelpStateResponse, UpdateHelpStateRequest } from '@/types/api';

function getDefaultHelpState(): HelpStateResponse {
  return {
    tour_completed: false,
    hotspots_seen: [],
    field_help_seen: [],
  };
}

interface HelpStateContextValue {
  state: HelpStateResponse;
  isLoading: boolean;
  tourActive: boolean;
  startTour: () => void;
  completeTour: () => Promise<void>;
  resetTour: () => Promise<void>;
  dismissHotspot: (id: string) => Promise<void>;
  dismissFieldHelp: (id: string) => Promise<void>;
  isHotspotSeen: (id: string) => boolean;
  isFieldHelpSeen: (id: string) => boolean;
}

const HelpStateContext = createContext<HelpStateContextValue | null>(null);

export function HelpStateProvider({ children }: { children: ReactNode }) {
  const { clerkUserId } = useAuth();
  const queryClient = useQueryClient();
  const [tourActive, setTourActive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['helpState'],
    queryFn: () => apiService.getHelpState(),
    enabled: !!clerkUserId,
    staleTime: 1000 * 60 * 10,
  });

  const mutation = useMutation({
    mutationFn: (req: UpdateHelpStateRequest) => apiService.updateHelpState(req),
    onSuccess: (updated) => {
      queryClient.setQueryData(['helpState'], updated);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiService.resetHelpState(),
    onSuccess: (updated) => {
      queryClient.setQueryData(['helpState'], updated);
    },
  });

  const helpState = data ?? getDefaultHelpState();

  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  const completeTour = useCallback(async () => {
    setTourActive(false);
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous) {
      queryClient.setQueryData(['helpState'], { ...previous, tour_completed: true });
    }
    try {
      await mutation.mutateAsync({ tour_completed: true });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const resetTour = useCallback(async () => {
    try {
      await resetMutation.mutateAsync();
      setTourActive(true);
    } catch {
      // Silently fail — tour will re-fetch on next load
    }
  }, [resetMutation]);

  const dismissHotspot = useCallback(async (id: string) => {
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous && !previous.hotspots_seen.includes(id)) {
      queryClient.setQueryData(['helpState'], {
        ...previous,
        hotspots_seen: [...previous.hotspots_seen, id],
      });
    }
    try {
      await mutation.mutateAsync({ dismiss_hotspot: id });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const dismissFieldHelp = useCallback(async (id: string) => {
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous && !previous.field_help_seen.includes(id)) {
      queryClient.setQueryData(['helpState'], {
        ...previous,
        field_help_seen: [...previous.field_help_seen, id],
      });
    }
    try {
      await mutation.mutateAsync({ dismiss_field_help: id });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const isHotspotSeen = useCallback(
    (id: string) => helpState.hotspots_seen.includes(id),
    [helpState.hotspots_seen],
  );

  const isFieldHelpSeen = useCallback(
    (id: string) => helpState.field_help_seen.includes(id),
    [helpState.field_help_seen],
  );

  const value: HelpStateContextValue = {
    state: helpState,
    isLoading,
    tourActive,
    startTour,
    completeTour,
    resetTour,
    dismissHotspot,
    dismissFieldHelp,
    isHotspotSeen,
    isFieldHelpSeen,
  };

  return (
    <HelpStateContext.Provider value={value}>
      {children}
    </HelpStateContext.Provider>
  );
}

export function useHelpState(): HelpStateContextValue {
  const ctx = useContext(HelpStateContext);
  if (!ctx) throw new Error('useHelpState must be used within HelpStateProvider');
  return ctx;
}
