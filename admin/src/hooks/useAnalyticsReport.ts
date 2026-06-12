import { useQuery } from '@tanstack/react-query';
import { getAnalyticsReport } from '@/services/analytics';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { DateRangeValue } from '@/pages/Analytics/components/DateRangeBar';
import { presetToDays } from '@/pages/Analytics/components/DateRangeBar';
import type { AnalyticsReportParams } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildParams(range: DateRangeValue): AnalyticsReportParams {
  if (range.preset) {
    return { days: presetToDays(range.preset) };
  }
  if (range.startDate && range.endDate) {
    return { startDate: toISODate(range.startDate), endDate: toISODate(range.endDate) };
  }
  return { days: 30 };
}

export function useAnalyticsReport(range: DateRangeValue) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const params = buildParams(range);

  const { data: report, isLoading, error } = useQuery({
    queryKey: queryKeys.analyticsReport(selectedSiteId, params),
    queryFn: () => getAnalyticsReport(selectedSiteId!, params),
    enabled: !!selectedSiteId && analyticsEnabled,
  });

  return { report, isLoading, error, analyticsEnabled };
}
