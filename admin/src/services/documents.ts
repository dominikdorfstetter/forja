import type {
  DocumentFolder,
  CreateDocumentFolderRequest,
  UpdateDocumentFolderRequest,
  DocumentListItem,
  DocumentResponse,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  DocumentLocalizationResponse,
  CreateDocumentLocalizationRequest,
  UpdateDocumentLocalizationRequest,
  SetDocumentPrivacyRequest,
  RemoveDocumentPrivacyRequest,
  VerifyDocumentAccessRequest,
  VerifyDocumentAccessResponse,
  BlogDocumentResponse,
  AssignBlogDocumentRequest,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiClient, apiRequest } from './http';

export const getDocumentFolders = (siteId: string) =>
  apiRequest<DocumentFolder[]>('GET', `/sites/${siteId}/document-folders`);

export const createDocumentFolder = (siteId: string, data: CreateDocumentFolderRequest) =>
  apiRequest<DocumentFolder>('POST', `/sites/${siteId}/document-folders`, data);

export const updateDocumentFolder = (id: string, data: UpdateDocumentFolderRequest) =>
  apiRequest<DocumentFolder>('PUT', `/document-folders/${id}`, data);

export const deleteDocumentFolder = (id: string) =>
  apiRequest<void>('DELETE', `/document-folders/${id}`);

export const getDocuments = (
  siteId: string,
  params?: ListQueryParams & { folder_id?: string },
) => apiRequest<Paginated<DocumentListItem>>(
  'GET',
  `/sites/${siteId}/documents`,
  undefined,
  { params },
);

export const getDocument = (id: string) =>
  apiRequest<DocumentResponse>('GET', `/documents/${id}`);

export const createDocument = (siteId: string, data: CreateDocumentRequest) =>
  apiRequest<DocumentListItem>('POST', `/sites/${siteId}/documents`, data);

export const updateDocument = (id: string, data: UpdateDocumentRequest) =>
  apiRequest<DocumentListItem>('PUT', `/documents/${id}`, data);

export const deleteDocument = (id: string) =>
  apiRequest<void>('DELETE', `/documents/${id}`);

export async function downloadDocument(id: string, token?: string): Promise<Blob> {
  const url = token
    ? `/documents/${id}/download?token=${encodeURIComponent(token)}`
    : `/documents/${id}/download`;
  const response = await apiClient.get(url, { responseType: 'blob' });
  return response.data;
}

export const verifyDocumentAccess = (id: string, data: VerifyDocumentAccessRequest) =>
  apiRequest<VerifyDocumentAccessResponse>('POST', `/documents/${id}/verify-access`, data);

export const setDocumentPrivacy = (id: string, data: SetDocumentPrivacyRequest) =>
  apiRequest<void>('POST', `/documents/${id}/privacy`, data);

export const removeDocumentPrivacy = (id: string, data: RemoveDocumentPrivacyRequest) =>
  apiRequest<void>('DELETE', `/documents/${id}/privacy`, data);

export const unlockDocumentAccess = (id: string) =>
  apiRequest<void>('POST', `/documents/${id}/unlock-access`);

export const createDocumentLocalization = (
  documentId: string,
  data: CreateDocumentLocalizationRequest,
) => apiRequest<DocumentLocalizationResponse>(
  'POST',
  `/documents/${documentId}/localizations`,
  data,
);

export const updateDocumentLocalization = (
  locId: string,
  data: UpdateDocumentLocalizationRequest,
) => apiRequest<DocumentLocalizationResponse>(
  'PUT',
  `/documents/localizations/${locId}`,
  data,
);

export const deleteDocumentLocalization = (locId: string) =>
  apiRequest<void>('DELETE', `/documents/localizations/${locId}`);

export const getBlogDocuments = (blogId: string) =>
  apiRequest<BlogDocumentResponse[]>('GET', `/blogs/${blogId}/documents`);

export const assignBlogDocument = (blogId: string, data: AssignBlogDocumentRequest) =>
  apiRequest<BlogDocumentResponse>('POST', `/blogs/${blogId}/documents`, data);

export const unassignBlogDocument = (blogId: string, documentId: string) =>
  apiRequest<void>('DELETE', `/blogs/${blogId}/documents/${documentId}`);
