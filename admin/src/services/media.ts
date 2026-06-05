import type {
  MediaListItem,
  MediaCategoryCounts,
  MediaResponse,
  MediaFolder,
  MediaMetadataResponse,
  CreateMediaFolderRequest,
  UpdateMediaFolderRequest,
  AddMediaMetadataRequest,
  UpdateMediaMetadataRequest,
  UploadMediaRequest,
  UpdateMediaRequest,
  SiteTagsResponse,
  MediaTagsResponse,
  MediaUsageResponse,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiClient, apiRequest } from './http';

export const getMedia = (
  siteId: string,
  params?: ListQueryParams & { mime_category?: string; folder_id?: string },
) => apiRequest<Paginated<MediaListItem>>(
  'GET',
  `/sites/${siteId}/media`,
  undefined,
  { params },
);

export const getMediaCategoryCounts = (siteId: string) =>
  apiRequest<MediaCategoryCounts>('GET', `/sites/${siteId}/media/category-counts`);

export const getMediaById = (id: string) =>
  apiRequest<MediaResponse>('GET', `/media/${id}`);

export const getMediaTags = (mediaId: string) =>
  apiRequest<MediaTagsResponse>('GET', `/media/${mediaId}/tags`);

export const updateMediaTags = (mediaId: string, tags: string[]) =>
  apiRequest<MediaTagsResponse>('PUT', `/media/${mediaId}/tags`, { tags });

export const getSiteTags = (
  siteId: string,
  params?: { prefix?: string; limit?: number },
) => apiRequest<SiteTagsResponse>(
  'GET',
  `/sites/${siteId}/media-tags`,
  undefined,
  { params },
);

export const getMediaUsage = (mediaId: string) =>
  apiRequest<MediaUsageResponse>('GET', `/media/${mediaId}/usage`);

export const uploadMedia = (data: UploadMediaRequest) =>
  apiRequest<MediaListItem>('POST', '/media', data);

export async function uploadMediaFile(
  file: File,
  siteIds: string[],
  folderId?: string,
  isGlobal?: boolean,
  onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void,
): Promise<MediaResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('site_ids', JSON.stringify(siteIds));
  if (folderId) formData.append('folder_id', folderId);
  if (isGlobal) formData.append('is_global', 'true');

  const response = await apiClient.post<MediaResponse>('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return response.data;
}

export const updateMedia = (id: string, data: UpdateMediaRequest) =>
  apiRequest<MediaListItem>('PUT', `/media/${id}`, data);

export const deleteMedia = (id: string, force?: boolean) => {
  const query = force ? '?force=true' : '';
  return apiRequest<void>('DELETE', `/media/${id}${query}`);
};

export const getMediaFolders = (siteId: string) =>
  apiRequest<MediaFolder[]>('GET', `/sites/${siteId}/media-folders`);

export const createMediaFolder = (siteId: string, data: CreateMediaFolderRequest) =>
  apiRequest<MediaFolder>('POST', `/sites/${siteId}/media-folders`, data);

export const updateMediaFolder = (id: string, data: UpdateMediaFolderRequest) =>
  apiRequest<MediaFolder>('PUT', `/media-folders/${id}`, data);

export const deleteMediaFolder = (id: string) =>
  apiRequest<void>('DELETE', `/media-folders/${id}`);

export const getMediaMetadata = (mediaId: string) =>
  apiRequest<MediaMetadataResponse[]>('GET', `/media/${mediaId}/metadata`);

export const createMediaMetadata = (mediaId: string, data: AddMediaMetadataRequest) =>
  apiRequest<MediaMetadataResponse>('POST', `/media/${mediaId}/metadata`, data);

export const updateMediaMetadata = (metadataId: string, data: UpdateMediaMetadataRequest) =>
  apiRequest<MediaMetadataResponse>('PUT', `/media/metadata/${metadataId}`, data);

export const deleteMediaMetadata = (metadataId: string) =>
  apiRequest<void>('DELETE', `/media/metadata/${metadataId}`);
