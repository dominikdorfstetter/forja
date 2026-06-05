import type {
  SiteLocaleResponse,
  AddSiteLocaleRequest,
  UpdateSiteLocaleRequest,
} from '@/types/api';
import { apiRequest } from './http';

export const getSiteLocales = (siteId: string) =>
  apiRequest<SiteLocaleResponse[]>('GET', `/sites/${siteId}/locales`);

export const addSiteLocale = (siteId: string, data: AddSiteLocaleRequest) =>
  apiRequest<SiteLocaleResponse>('POST', `/sites/${siteId}/locales`, data);

export const updateSiteLocale = (
  siteId: string,
  localeId: string,
  data: UpdateSiteLocaleRequest,
) => apiRequest<SiteLocaleResponse>('PUT', `/sites/${siteId}/locales/${localeId}`, data);

export const removeSiteLocale = (siteId: string, localeId: string) =>
  apiRequest<void>('DELETE', `/sites/${siteId}/locales/${localeId}`);

export const setSiteDefaultLocale = (siteId: string, localeId: string) =>
  apiRequest<void>('PUT', `/sites/${siteId}/locales/${localeId}/default`);
