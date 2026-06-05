import { useQuery } from '@tanstack/react-query';
import { getImprint } from '@/services/imprint';
import type { ImprintResponse } from '@/types/api';

/**
 * Fetch the public imprint config. Shared by the Welcome footer (to decide
 * whether to show the Imprint link) and the Imprint page. Values change only
 * on redeploy, so it is cached aggressively.
 */
export function useImprint() {
  return useQuery<ImprintResponse>({
    queryKey: ['imprint'],
    queryFn: getImprint,
    staleTime: 1000 * 60 * 60, // 1h — operator details change only on redeploy
  });
}
