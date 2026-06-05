import type {
  FormListItem,
  FormDetailResponse,
  CreateFormRequest,
  UpdateFormRequest,
  FormTemplateResponse,
  CreateFormTemplateRequest,
  UpdateFormTemplateRequest,
  SubmissionListItem,
  SubmissionStatusCounts,
  SubmissionDetailResponse,
  SubmissionNoteResponse,
  UpdateSubmissionStatusRequest,
  CreateSubmissionNoteRequest,
  FormSubmissionStatus,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getForms = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<FormListItem>>('GET', `/sites/${siteId}/forms`, undefined, { params });

export const getForm = (id: string) =>
  apiRequest<FormDetailResponse>('GET', `/forms/${id}`);

export const createForm = (siteId: string, data: CreateFormRequest) =>
  apiRequest<FormDetailResponse>('POST', `/sites/${siteId}/forms`, data);

export const updateForm = (id: string, data: UpdateFormRequest) =>
  apiRequest<FormDetailResponse>('PUT', `/forms/${id}`, data);

export const deleteForm = (id: string) =>
  apiRequest<void>('DELETE', `/forms/${id}`);

export const getFormTemplates = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<FormTemplateResponse>>(
    'GET',
    `/sites/${siteId}/form-templates`,
    undefined,
    { params },
  );

export const getFormTemplate = (id: string) =>
  apiRequest<FormTemplateResponse>('GET', `/form-templates/${id}`);

export const createFormTemplate = (siteId: string, data: CreateFormTemplateRequest) =>
  apiRequest<FormTemplateResponse>('POST', `/sites/${siteId}/form-templates`, data);

export const updateFormTemplate = (id: string, data: UpdateFormTemplateRequest) =>
  apiRequest<FormTemplateResponse>('PUT', `/form-templates/${id}`, data);

export const deleteFormTemplate = (id: string) =>
  apiRequest<void>('DELETE', `/form-templates/${id}`);

export const getSubmissions = (
  formId: string,
  params?: { page?: number; page_size?: number; status?: FormSubmissionStatus },
) => apiRequest<Paginated<SubmissionListItem>>(
  'GET',
  `/forms/${formId}/submissions`,
  undefined,
  { params },
);

export const getSubmissionStatusCounts = (formId: string) =>
  apiRequest<SubmissionStatusCounts>('GET', `/forms/${formId}/submissions/status-counts`);

export const getSubmission = (id: string) =>
  apiRequest<SubmissionDetailResponse>('GET', `/submissions/${id}`);

export const updateSubmissionStatus = (id: string, data: UpdateSubmissionStatusRequest) =>
  apiRequest<SubmissionDetailResponse>('PUT', `/submissions/${id}/status`, data);

export const deleteSubmission = (id: string) =>
  apiRequest<void>('DELETE', `/submissions/${id}`);

export const createSubmissionNote = (id: string, data: CreateSubmissionNoteRequest) =>
  apiRequest<SubmissionNoteResponse>('POST', `/submissions/${id}/notes`, data);

export const deleteSubmissionNote = (id: string, noteId: string) =>
  apiRequest<void>('DELETE', `/submissions/${id}/notes/${noteId}`);
