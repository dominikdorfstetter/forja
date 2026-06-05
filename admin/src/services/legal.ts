import type {
  LegalDocumentResponse,
  LegalDocumentFullDetailResponse,
  LegalVersionResponse,
  CreateLegalDocumentRequest,
  UpdateLegalDocumentRequest,
  LegalGroupResponse,
  CreateLegalGroupRequest,
  UpdateLegalGroupRequest,
  LegalItemResponse,
  CreateLegalItemRequest,
  UpdateLegalItemRequest,
} from '@/types/api';
import { apiRequest } from './http';
import { createContentService } from './contentService';

const svc = createContentService<
  LegalDocumentResponse,
  LegalDocumentFullDetailResponse,
  LegalDocumentResponse,
  CreateLegalDocumentRequest,
  UpdateLegalDocumentRequest
>({ base: 'legal' });

// Shared CRUD surface (ADR 0003 uniform routes). Legal re-exports the
// slice that applies — it has no bulk/review, and create diverges (below).
export const getLegalDocuments = svc.list;
export const getLegalDocumentDetail = svc.detail;
export const updateLegalDocument = svc.update;
export const deleteLegalDocument = svc.remove;
export const getLegalLocalizations = svc.getLocalizations;
export const createLegalLocalization = svc.createLocalization;
export const updateLegalLocalization = svc.updateLocalization;

// Entity-specific extras. Legal documents are created site-scoped
// (`/sites/{siteId}/legal`), unlike the other content types.
export const createLegalDocument = (siteId: string, data: CreateLegalDocumentRequest) =>
  apiRequest<LegalDocumentResponse>('POST', `/sites/${siteId}/legal`, data);

export const getLegalGroups = (documentId: string) =>
  apiRequest<LegalGroupResponse[]>('GET', `/legal/${documentId}/groups`);

export const createLegalGroup = (documentId: string, data: CreateLegalGroupRequest) =>
  apiRequest<LegalGroupResponse>('POST', `/legal/${documentId}/groups`, data);

export const updateLegalGroup = (id: string, data: UpdateLegalGroupRequest) =>
  apiRequest<LegalGroupResponse>('PUT', `/legal/groups/${id}`, data);

export const deleteLegalGroup = (id: string) =>
  apiRequest<void>('DELETE', `/legal/groups/${id}`);

export const getLegalItems = (groupId: string) =>
  apiRequest<LegalItemResponse[]>('GET', `/legal/groups/${groupId}/items`);

export const createLegalItem = (groupId: string, data: CreateLegalItemRequest) =>
  apiRequest<LegalItemResponse>('POST', `/legal/groups/${groupId}/items`, data);

export const updateLegalItem = (id: string, data: UpdateLegalItemRequest) =>
  apiRequest<LegalItemResponse>('PUT', `/legal/items/${id}`, data);

export const deleteLegalItem = (id: string) =>
  apiRequest<void>('DELETE', `/legal/items/${id}`);

export const getLegalVersions = (id: string) =>
  apiRequest<LegalVersionResponse[]>('GET', `/legal/${id}/versions`);

export const createLegalVersion = (id: string) =>
  apiRequest<LegalDocumentResponse>('POST', `/legal/${id}/new-version`);
