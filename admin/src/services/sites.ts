import type {
  Site,
  CreateSiteRequest,
  UpdateSiteRequest,
  SiteContextResponse,
  SiteSettingsResponse,
  UpdateSiteSettingsRequest,
  SiteExportJob,
  StorageUsageResponse,
  SystemStorageOverviewResponse,
  SitesOverviewResponse,
  TrashListResponse,
  TrashCountResponse,
  PreviewTokenResponse,
  FaviconResponse,
  OnboardingProgressResponse,
  CompleteStepRequest,
} from '@/types/api';
import { apiClient, apiRequest } from './http';

export const getSites = () => apiRequest<Site[]>('GET', '/sites');
export const getSite = (id: string) => apiRequest<Site>('GET', `/sites/${id}`);
export const createSite = (data: CreateSiteRequest) => apiRequest<Site>('POST', '/sites', data);
export const updateSite = (id: string, data: UpdateSiteRequest) =>
  apiRequest<Site>('PUT', `/sites/${id}`, data);
export const deleteSite = (id: string) => apiRequest<void>('DELETE', `/sites/${id}`);
/**
 * Bulk soft-delete every site-scoped content item and site-owned media
 * file into the 30-day trash (issue #714/#715). Settings and members are
 * kept. The backend returns per-category counts; the UI only needs the
 * success signal, so the body is discarded.
 */
export const resetContent = (id: string) =>
  apiRequest<void>('POST', `/sites/${id}/reset-content`);
export const getDeletedSites = () => apiRequest<Site[]>('GET', '/sites/deleted');
export const restoreSite = (id: string) =>
  apiRequest<Site>('POST', `/sites/${id}/restore`);
/**
 * Async site-archive export (#716/#717 backend, #718 wiring).
 * `startSiteExport` enqueues a job (202 → `queued`); poll
 * `getSiteExportJob` until the status is `ready` (carries an expiring
 * signed `download_url`) or `failed`. `downloadSiteExport` follows that
 * signed link through {@link apiClient} so the Clerk bearer rides along —
 * the download endpoint guards on both the per-job token *and* the
 * caller's export role, so a bare anchor would 401. Mirrors the
 * `downloadFaviconPackage` blob convention above.
 */
export const startSiteExport = (siteId: string) =>
  apiRequest<SiteExportJob>('POST', `/sites/${siteId}/export`);
export const getSiteExportJob = (siteId: string, jobId: string) =>
  apiRequest<SiteExportJob>('GET', `/sites/${siteId}/export/${jobId}`);
export async function downloadSiteExport(downloadUrl: string): Promise<Blob> {
  // The backend owns route construction and returns an absolute
  // `/api/v1/...` path; apiClient already prefixes its baseURL, so strip
  // the duplicate prefix and let it sign + send the request.
  const path = downloadUrl.replace(/^\/api\/v1/, '');
  const response = await apiClient.get(path, { responseType: 'blob' });
  return response.data;
}

export const getSiteContext = (siteId: string) =>
  apiRequest<SiteContextResponse>('GET', `/sites/${siteId}/context`);
export const leaveSite = (siteId: string) =>
  apiRequest<void>('DELETE', `/sites/${siteId}/leave`);

export const getSiteSettings = (siteId: string) =>
  apiRequest<SiteSettingsResponse>('GET', `/sites/${siteId}/settings`);
export const updateSiteSettings = (siteId: string, data: UpdateSiteSettingsRequest) =>
  apiRequest<SiteSettingsResponse>('PUT', `/sites/${siteId}/settings`, data);

export const getStorageUsage = (siteId: string) =>
  apiRequest<StorageUsageResponse>('GET', `/sites/${siteId}/storage`);
export const getSystemStorageOverview = () =>
  apiRequest<SystemStorageOverviewResponse>('GET', '/admin/storage');
export const getSitesOverview = () =>
  apiRequest<SitesOverviewResponse>('GET', '/admin/sites/overview');

export const getTrash = (siteId: string, page = 1, pageSize = 10) =>
  apiRequest<TrashListResponse>(
    'GET',
    `/sites/${siteId}/trash?page=${page}&page_size=${pageSize}`,
  );
export const getTrashCount = (siteId: string) =>
  apiRequest<TrashCountResponse>('GET', `/sites/${siteId}/trash/count`);
export const restoreTrashItem = (contentId: string, entityType?: string) => {
  const params = entityType ? `?entity_type=${entityType}` : '';
  return apiRequest<void>('POST', `/trash/${contentId}/restore${params}`);
};
export const permanentDeleteTrashItem = (contentId: string, entityType?: string) => {
  const params = entityType ? `?entity_type=${entityType}` : '';
  return apiRequest<void>('DELETE', `/trash/${contentId}${params}`);
};

export const getPreviewToken = (siteId: string) =>
  apiRequest<PreviewTokenResponse>('GET', `/sites/${siteId}/preview-token`);

export const getOnboardingProgress = (siteId: string) =>
  apiRequest<OnboardingProgressResponse>('GET', `/sites/${siteId}/onboarding-progress`);
export const completeOnboardingStep = (siteId: string, data: CompleteStepRequest) =>
  apiRequest<OnboardingProgressResponse>('PUT', `/sites/${siteId}/onboarding-progress`, data);

export async function uploadFavicon(siteId: string, file: File): Promise<FaviconResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<FaviconResponse>(
    `/sites/${siteId}/favicon`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export const getFavicon = (siteId: string) =>
  apiRequest<FaviconResponse>('GET', `/sites/${siteId}/favicon`);

export async function downloadFaviconPackage(siteId: string): Promise<Blob> {
  const response = await apiClient.get(`/sites/${siteId}/favicon/download`, {
    responseType: 'blob',
  });
  return response.data;
}
