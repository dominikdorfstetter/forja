import type {
  PageListItem,
  PageStatusCounts,
  PageResponse,
  PageDetailResponse,
  CreatePageRequest,
  UpdatePageRequest,
  PageSectionResponse,
  CreatePageSectionRequest,
  UpdatePageSectionRequest,
  SectionLocalizationResponse,
  UpsertSectionLocalizationRequest,
  ReorderItem,
  ListQueryParams,
} from '@/types/api';
import { apiRequest } from './http';
import { createContentService } from './contentService';

const svc = createContentService<
  PageListItem,
  PageDetailResponse,
  PageResponse,
  CreatePageRequest,
  UpdatePageRequest,
  ListQueryParams & { status?: string; page_type?: string; exclude_status?: string }
>({ base: 'pages' });

// Shared CRUD surface (ADR 0003 uniform routes).
export const getPages = svc.list;
export const getPageDetail = svc.detail;
export const createPage = svc.create;
export const updatePage = svc.update;
export const deletePage = svc.remove;
export const bulkPages = svc.bulk;
export const reviewPage = svc.review;
export const getPageLocalizations = svc.getLocalizations;
export const createPageLocalization = svc.createLocalization;
export const updatePageLocalization = svc.updateLocalization;
export const deletePageLocalization = svc.deleteLocalization;

// Entity-specific extras.
export const getPageStatusCounts = (siteId: string) =>
  apiRequest<PageStatusCounts>('GET', `/sites/${siteId}/pages/status-counts`);

// Pages additionally expose the lightweight bare single item (ADR 0003);
// other content types do not need it in the admin surface.
export const getPage = (id: string) => apiRequest<PageResponse>('GET', `/pages/${id}`);

export const clonePage = (id: string) =>
  apiRequest<PageResponse>('POST', `/pages/${id}/clone`);

export const getPageSections = (pageId: string) =>
  apiRequest<PageSectionResponse[]>('GET', `/pages/${pageId}/sections`);

export const createPageSection = (pageId: string, data: CreatePageSectionRequest) =>
  apiRequest<PageSectionResponse>('POST', `/pages/${pageId}/sections`, data);

export const updatePageSection = (id: string, data: UpdatePageSectionRequest) =>
  apiRequest<PageSectionResponse>('PUT', `/pages/sections/${id}`, data);

export const deletePageSection = (id: string) =>
  apiRequest<void>('DELETE', `/pages/sections/${id}`);

export const reorderPageSections = (pageId: string, items: ReorderItem[]) =>
  apiRequest<void>('POST', `/pages/${pageId}/sections/reorder`, { items });

export const getSectionLocalizations = (sectionId: string) =>
  apiRequest<SectionLocalizationResponse[]>(
    'GET',
    `/pages/sections/${sectionId}/localizations`,
  );

export const getPageSectionLocalizations = (pageId: string) =>
  apiRequest<SectionLocalizationResponse[]>(
    'GET',
    `/pages/${pageId}/sections/localizations`,
  );

export const upsertSectionLocalization = (
  sectionId: string,
  data: UpsertSectionLocalizationRequest,
) => apiRequest<SectionLocalizationResponse>(
  'PUT',
  `/pages/sections/${sectionId}/localizations`,
  data,
);

export const deleteSectionLocalization = (id: string) =>
  apiRequest<void>('DELETE', `/pages/sections/localizations/${id}`);
