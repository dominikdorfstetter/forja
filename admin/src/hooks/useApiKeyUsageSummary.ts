import { useQuery } from '@tanstack/react-query';
import { getApiKeyUsageSummary } from '@/services/apiKeys';
import type { UsageSummaryResponse } from '@/types/api';

export function useApiKeyUsageSummary(keyId: string | null, options?: { days?: number }) {
  return useQuery<UsageSummaryResponse>({
    queryKey: ['apiKeyUsageSummary', keyId, options?.days],
    queryFn: () => getApiKeyUsageSummary(keyId!, { days: options?.days }),
    enabled: !!keyId,
    refetchInterval: 60_000, // Refresh every minute while dialog is open
  });
}
