import type {
  ApiKey,
  ApiKeyListItem,
  ApiKeyUsageRecord,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListQueryParams,
  Paginated,
  UpdateApiKeyRequest,
  UsageSummaryResponse,
} from '@/types/api';
import { apiRequest } from './http';

export const getApiKeys = (params?: ListQueryParams & {
  status?: string;
  permission?: string;
  site_id?: string;
}) => apiRequest<Paginated<ApiKeyListItem>>('GET', '/api-keys', undefined, { params });

export const getApiKey = (id: string) => apiRequest<ApiKey>('GET', `/api-keys/${id}`);
export const createApiKey = (data: CreateApiKeyRequest) =>
  apiRequest<CreateApiKeyResponse>('POST', '/api-keys', data);
export const updateApiKey = (id: string, data: UpdateApiKeyRequest) =>
  apiRequest<ApiKey>('PUT', `/api-keys/${id}`, data);
export const deleteApiKey = (id: string) => apiRequest<void>('DELETE', `/api-keys/${id}`);

export const blockApiKey = (id: string, reason: string) =>
  apiRequest<ApiKey>('POST', `/api-keys/${id}/block`, { reason });
export const unblockApiKey = (id: string) =>
  apiRequest<ApiKey>('POST', `/api-keys/${id}/unblock`);
export const revokeApiKey = (id: string) =>
  apiRequest<ApiKey>('POST', `/api-keys/${id}/revoke`);

export const getApiKeyUsage = (id: string, params?: { limit?: number; offset?: number }) =>
  apiRequest<ApiKeyUsageRecord[]>('GET', `/api-keys/${id}/usage`, undefined, { params });
export const getApiKeyUsageSummary = (id: string, params?: { days?: number }) =>
  apiRequest<UsageSummaryResponse>('GET', `/api-keys/${id}/usage/summary`, undefined, { params });
