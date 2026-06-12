import { useQuery } from '@tanstack/react-query';

import { getAnalyticsReport } from '@/services/analytics';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { queryKeys } from '@/lib/queryKeys';

export function useAnalyticsData(days: number = 30) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const { data: report, isLoading } = useQuery({
    queryKey: queryKeys.analyticsReport(selectedSiteId, days),
    queryFn: () => getAnalyticsReport(selectedSiteId!, { days }),
    enabled: !!selectedSiteId && analyticsEnabled,
  });

  return {
    report,
    isLoading,
    analyticsEnabled,
  };
}
