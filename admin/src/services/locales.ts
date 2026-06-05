import type {
  Locale,
  CreateLocaleRequest,
  UpdateLocaleRequest,
} from '@/types/api';
import { apiRequest } from './http';

export const getLocales = (includeInactive?: boolean) => {
  const params = includeInactive ? { include_inactive: true } : undefined;
  return apiRequest<Locale[]>('GET', '/locales', undefined, { params });
};

export const createLocale = (data: CreateLocaleRequest) =>
  apiRequest<Locale>('POST', '/locales', data);
export const updateLocale = (id: string, data: UpdateLocaleRequest) =>
  apiRequest<Locale>('PUT', `/locales/${id}`, data);
export const deleteLocale = (id: string) => apiRequest<void>('DELETE', `/locales/${id}`);
