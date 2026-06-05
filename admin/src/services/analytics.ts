import type {
  AnalyticsReportResponse,
  AnalyticsMaintenanceResponse,
  AnalyticsPageDetailResponse,
  AnalyticsReportParams,
  AnalyticsPageDetailParams,
} from '@/types/api';
import { apiRequest } from './http';

export const getAnalyticsReport = (siteId: string, params?: AnalyticsReportParams) =>
  apiRequest<AnalyticsReportResponse>(
    'GET',
    `/sites/${siteId}/analytics/report`,
    undefined,
    {
      params: {
        days: params?.days,
        top_n: params?.topN,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    },
  );

export const getAnalyticsPageDetail = (siteId: string, params: AnalyticsPageDetailParams) =>
  apiRequest<AnalyticsPageDetailResponse>(
    'GET',
    `/sites/${siteId}/analytics/report/page`,
    undefined,
    {
      params: {
        path: params.path,
        days: params.days,
        start_date: params.startDate,
        end_date: params.endDate,
      },
    },
  );

export const aggregateAnalytics = (siteId: string, retentionDays?: number) =>
  apiRequest<AnalyticsMaintenanceResponse>(
    'POST',
    `/sites/${siteId}/analytics/aggregate`,
    undefined,
    { params: { retention_days: retentionDays } },
  );
