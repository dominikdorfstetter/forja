import { useQuery } from '@tanstack/react-query';

import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';

export function useAnalyticsData(days: number = 30) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const { data: report, isLoading } = useQuery({
    queryKey: ['analytics-report', selectedSiteId, days],
    queryFn: () => apiService.getAnalyticsReport(selectedSiteId!, days),
    enabled: !!selectedSiteId && analyticsEnabled,
  });

  return {
    report,
    isLoading,
    analyticsEnabled,
  };
}
