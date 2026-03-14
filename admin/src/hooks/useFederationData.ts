import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';

export function useFederationStats(siteId: string) {
  return useQuery({
    queryKey: ['federation-stats', siteId],
    queryFn: () => apiService.getFederationStats(siteId),
    enabled: !!siteId,
  });
}

export function useFederationSettings(siteId: string) {
  return useQuery({
    queryKey: ['federation-settings', siteId],
    queryFn: () => apiService.getFederationSettings(siteId),
    enabled: !!siteId,
  });
}

export function useFederationEngagement(siteId: string, contentId: string) {
  return useQuery({
    queryKey: ['federation-engagement', siteId, contentId],
    queryFn: () => apiService.getFederationEngagement(siteId, contentId),
    enabled: !!siteId && !!contentId,
  });
}
