import type {
  ContentTemplate,
  CreateContentTemplateRequest,
  UpdateContentTemplateRequest,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getContentTemplates = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<ContentTemplate>>(
    'GET',
    `/sites/${siteId}/content-templates`,
    undefined,
    { params },
  );

export const getContentTemplate = (id: string) =>
  apiRequest<ContentTemplate>('GET', `/content-templates/${id}`);

export const createContentTemplate = (
  siteId: string,
  data: Omit<CreateContentTemplateRequest, 'site_id'>,
) => apiRequest<ContentTemplate>(
  'POST',
  `/sites/${siteId}/content-templates`,
  { ...data, site_id: siteId },
);

export const updateContentTemplate = (id: string, data: UpdateContentTemplateRequest) =>
  apiRequest<ContentTemplate>('PUT', `/content-templates/${id}`, data);

export const deleteContentTemplate = (id: string) =>
  apiRequest<void>('DELETE', `/content-templates/${id}`);
