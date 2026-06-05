import { describe, expect, it, vi } from 'vitest';
import { AnalyticsResource } from '../../resources/analytics.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('AnalyticsResource', () => {
  describe('trackPageview', () => {
    it('posts pageview data', async () => {
      const http = createMockHttp();
      vi.mocked(http.post).mockResolvedValue({ ok: true });

      const analytics = new AnalyticsResource(http, siteId);
      const result = await analytics.trackPageview({
        path: '/blog/hello',
        referrer: 'https://google.com',
      });

      expect(http.post).toHaveBeenCalledWith(
        `/sites/${siteId}/analytics/pageview`,
        { path: '/blog/hello', referrer: 'https://google.com' },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('getReport', () => {
    it('fetches analytics report with default params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        total_views: 100,
        total_unique_visitors: 50,
        top_content: [],
        trend: [],
      });

      const analytics = new AnalyticsResource(http, siteId);
      await analytics.getReport();

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/analytics/report`,
        undefined,
      );
    });

    it('passes report params as snake_case query', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        total_views: 0,
        total_unique_visitors: 0,
        top_content: [],
        trend: [],
      });

      const analytics = new AnalyticsResource(http, siteId);
      await analytics.getReport({ days: 30, topN: 5 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/analytics/report`,
        expect.objectContaining({ days: '30', top_n: '5' }),
      );
    });

    it('passes date range params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        total_views: 0,
        total_unique_visitors: 0,
        top_content: [],
        trend: [],
      });

      const analytics = new AnalyticsResource(http, siteId);
      await analytics.getReport({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/analytics/report`,
        expect.objectContaining({
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        }),
      );
    });
  });

  describe('getPageAnalytics', () => {
    it('fetches analytics for a specific page', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        path: '/blog/hello',
        total_views: 42,
        total_unique_visitors: 20,
        trend: [],
        referrers: [],
      });

      const analytics = new AnalyticsResource(http, siteId);
      const result = await analytics.getPageAnalytics({
        path: '/blog/hello',
        days: 7,
      });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/analytics/report/page`,
        expect.objectContaining({ path: '/blog/hello', days: '7' }),
      );
      expect(result.total_views).toBe(42);
    });
  });
});
