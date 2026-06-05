import type {
  SiteCacheStats,
  GlobalCacheStats,
  CacheMutationResponse,
} from '@/types/api';
import { apiRequest } from './http';

// Per-site cache (site admin)
export const getSiteCacheStats = (siteId: string) =>
  apiRequest<SiteCacheStats>('GET', `/sites/${siteId}/cache`);

export const invalidateSiteCache = (siteId: string) =>
  apiRequest<CacheMutationResponse>('POST', `/sites/${siteId}/cache/invalidate`);

export const rebuildSiteCache = (siteId: string) =>
  apiRequest<CacheMutationResponse>('POST', `/sites/${siteId}/cache/rebuild`);

// Overall cache (system admin)
export const getGlobalCacheStats = () =>
  apiRequest<GlobalCacheStats>('GET', '/cache');

export const invalidateAllCache = () =>
  apiRequest<CacheMutationResponse>('POST', '/cache/invalidate');
