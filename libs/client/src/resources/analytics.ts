import type { HttpClient } from '../http.js';
import { toQueryParams } from '../http.js';
import type {
  AnalyticsPageDetailResponse,
  AnalyticsPageParams,
  AnalyticsReportParams,
  AnalyticsReportResponse,
  TrackPageviewRequest,
  TrackPageviewResponse,
} from '../types.js';

/**
 * Privacy-first analytics operations.
 *
 * Track pageviews and retrieve analytics reports. Forja analytics is
 * cookie-free, GDPR-compliant by design — no PII is stored, visitor
 * hashes are rotated daily, and raw data is pruned after a configurable retention period.
 *
 * Pageview tracking requires an API key with `Read` permission.
 * Reports require `Read` permission.
 */
export class AnalyticsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Track a pageview.
   *
   * **Endpoint:** `POST /sites/{siteId}/analytics/pageview`
   *
   * The server computes the visitor hash from the client IP and user agent.
   * No cookies or PII are stored.
   *
   * @param request - The pageview data.
   * @param request.path - The page path (e.g. `"/blog/hello-world"`).
   * @param request.referrer - Optional full referrer URL (only the domain is stored).
   * @returns Acknowledgement (`{ ok: true }`).
   *
   * @example
   * ```ts
   * await forja.analytics.trackPageview({ path: '/blog/hello-world' });
   * ```
   */
  async trackPageview(
    request: TrackPageviewRequest,
  ): Promise<TrackPageviewResponse> {
    return this.http.post<TrackPageviewResponse>(
      `/sites/${this.siteId}/analytics/pageview`,
      request,
    );
  }

  /**
   * Fetch an analytics summary report for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/analytics/report?days=&top_n=&start_date=&end_date=`
   *
   * Returns total views, unique visitors, top content pages, and daily trends.
   *
   * @param params - Report parameters.
   * @param params.days - Number of days to look back (default: 30). Ignored if date range is set.
   * @param params.topN - Number of top content pages to include (default: 10).
   * @param params.startDate - Start date in `YYYY-MM-DD` format.
   * @param params.endDate - End date in `YYYY-MM-DD` format.
   * @returns The analytics report with totals, top content, and daily trend data.
   *
   * @example
   * ```ts
   * const report = await forja.analytics.getReport({ days: 7, topN: 5 });
   * console.log(`${report.total_views} views, ${report.total_unique_visitors} unique`);
   * ```
   */
  async getReport(
    params?: AnalyticsReportParams,
  ): Promise<AnalyticsReportResponse> {
    const query = params
      ? toQueryParams({
          days: params.days,
          top_n: params.topN,
          start_date: params.startDate,
          end_date: params.endDate,
        })
      : undefined;
    return this.http.get<AnalyticsReportResponse>(
      `/sites/${this.siteId}/analytics/report`,
      query,
    );
  }

  /**
   * Fetch analytics for a specific page path.
   *
   * **Endpoint:** `GET /sites/{siteId}/analytics/report/page?path=&days=&start_date=&end_date=`
   *
   * Returns views, unique visitors, daily trend, and top referrer domains for a single page.
   *
   * @param params - Page analytics parameters.
   * @param params.path - The page path to query (e.g. `"/blog/hello-world"`).
   * @param params.days - Number of days to look back.
   * @param params.startDate - Start date in `YYYY-MM-DD` format.
   * @param params.endDate - End date in `YYYY-MM-DD` format.
   * @returns Page-level analytics with trend and referrer data.
   *
   * @example
   * ```ts
   * const stats = await forja.analytics.getPageAnalytics({
   *   path: '/blog/hello-world',
   *   days: 30,
   * });
   * console.log(stats.referrers); // [{ domain: "google.com", views: 42 }, ...]
   * ```
   */
  async getPageAnalytics(
    params: AnalyticsPageParams,
  ): Promise<AnalyticsPageDetailResponse> {
    const query = toQueryParams({
      path: params.path,
      days: params.days,
      start_date: params.startDate,
      end_date: params.endDate,
    });
    return this.http.get<AnalyticsPageDetailResponse>(
      `/sites/${this.siteId}/analytics/report/page`,
      query,
    );
  }
}
