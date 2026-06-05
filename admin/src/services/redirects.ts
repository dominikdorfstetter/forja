import type {
  Redirect,
  CreateRedirectRequest,
  UpdateRedirectRequest,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getRedirects = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<Redirect>>(
    'GET',
    `/sites/${siteId}/redirects`,
    undefined,
    { params },
  );

export const createRedirect = (
  siteId: string,
  data: Omit<CreateRedirectRequest, 'site_id'>,
) => apiRequest<Redirect>('POST', `/sites/${siteId}/redirects`, { ...data, site_id: siteId });

export const updateRedirect = (id: string, data: UpdateRedirectRequest) =>
  apiRequest<Redirect>('PUT', `/redirects/${id}`, data);

export const deleteRedirect = (id: string) =>
  apiRequest<void>('DELETE', `/redirects/${id}`);
