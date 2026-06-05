/**
 * Custom-types ("Collections", #789) API client. Thin wrappers over
 * {@link apiRequest} for schema (type) CRUD, entry CRUD + publish actions,
 * and the GDPR Art. 30 RoPA export.
 */
import type { Paginated } from '@/types/api';
import type {
  CreateCustomTypeRequest,
  CustomEntryRequest,
  CustomEntryResponse,
  CustomEntrySummary,
  CustomTypeResponse,
  CustomTypeSummary,
  RopaReport,
  UpdateCustomTypeRequest,
} from '@/types/customTypes';
import { apiRequest } from './http';

const base = (siteId: string) => `/sites/${siteId}/custom-types`;
const entries = (siteId: string, typeKey: string) =>
  `${base(siteId)}/${encodeURIComponent(typeKey)}/entries`;

// ── Type (schema) CRUD ───────────────────────────────────────────────────────

export const listCustomTypes = (siteId: string) =>
  apiRequest<CustomTypeSummary[]>('GET', base(siteId));

export const getCustomType = (siteId: string, typeKey: string) =>
  apiRequest<CustomTypeResponse>('GET', `${base(siteId)}/${encodeURIComponent(typeKey)}`);

export const createCustomType = (siteId: string, data: CreateCustomTypeRequest) =>
  apiRequest<CustomTypeResponse>('POST', base(siteId), data);

export const updateCustomType = (
  siteId: string,
  typeKey: string,
  data: UpdateCustomTypeRequest,
) => apiRequest<CustomTypeResponse>('PUT', `${base(siteId)}/${encodeURIComponent(typeKey)}`, data);

export const deleteCustomType = (siteId: string, typeKey: string, force = false) =>
  apiRequest<void>(
    'DELETE',
    `${base(siteId)}/${encodeURIComponent(typeKey)}${force ? '?force=true' : ''}`,
  );

// ── Entry CRUD + publish ─────────────────────────────────────────────────────

export interface EntryListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export const listEntries = (siteId: string, typeKey: string, params?: EntryListParams) => {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('page_size', String(params.pageSize));
  const qs = q.toString();
  return apiRequest<Paginated<CustomEntrySummary>>(
    'GET',
    `${entries(siteId, typeKey)}${qs ? `?${qs}` : ''}`,
  );
};

export const getEntry = (siteId: string, typeKey: string, entryId: string) =>
  apiRequest<CustomEntryResponse>('GET', `${entries(siteId, typeKey)}/${entryId}`);

export const createEntry = (siteId: string, typeKey: string, data: CustomEntryRequest) =>
  apiRequest<CustomEntryResponse>('POST', entries(siteId, typeKey), data);

export const updateEntry = (
  siteId: string,
  typeKey: string,
  entryId: string,
  data: CustomEntryRequest,
) => apiRequest<CustomEntryResponse>('PUT', `${entries(siteId, typeKey)}/${entryId}`, data);

export const deleteEntry = (siteId: string, typeKey: string, entryId: string) =>
  apiRequest<void>('DELETE', `${entries(siteId, typeKey)}/${entryId}`);

export const publishEntry = (siteId: string, typeKey: string, entryId: string) =>
  apiRequest<CustomEntryResponse>('POST', `${entries(siteId, typeKey)}/${entryId}/publish`);

export const unpublishEntry = (siteId: string, typeKey: string, entryId: string) =>
  apiRequest<CustomEntryResponse>('POST', `${entries(siteId, typeKey)}/${entryId}/unpublish`);

export const eraseEntryPii = (siteId: string, typeKey: string, entryId: string) =>
  apiRequest<void>('POST', `${entries(siteId, typeKey)}/${entryId}/erase-pii`);

// ── RoPA ─────────────────────────────────────────────────────────────────────

export const getRopa = (siteId: string) => apiRequest<RopaReport>('GET', `/sites/${siteId}/ropa`);
