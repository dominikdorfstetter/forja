import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { DateRangeValue } from '@/pages/Analytics/components/DateRangeBar';
import { presetToDays } from '@/pages/Analytics/components/DateRangeBar';
import type { AnalyticsPageDetailParams } from '@/types/api';

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildParams(path: string, range: DateRangeValue): AnalyticsPageDetailParams {
  if (range.preset) {
    return { path, days: presetToDays(range.preset) };
  }
  if (range.startDate && range.endDate) {
    return { path, startDate: toISODate(range.startDate), endDate: toISODate(range.endDate) };
  }
  return { path, days: 30 };
}

export function useAnalyticsPageDetail(path: string, range: DateRangeValue) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const params = buildParams(path, range);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['analytics-page-detail', selectedSiteId, params],
    queryFn: () => apiService.getAnalyticsPageDetail(selectedSiteId!, params),
    enabled: !!selectedSiteId && !!path && analyticsEnabled,
  });

  return { detail, isLoading, error, analyticsEnabled };
}
