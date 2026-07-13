import type {
  CreateUiStringRequest,
  UiStringResponse,
  UpdateUiStringRequest,
} from '@/types/api';
import { apiRequest } from './http';

const base = (siteId: string) => `/sites/${siteId}/strings`;

export const getUiStringEntries = (siteId: string) =>
  apiRequest<UiStringResponse[]>('GET', `${base(siteId)}/entries`);

export const createUiString = (siteId: string, data: CreateUiStringRequest) =>
  apiRequest<UiStringResponse>('POST', base(siteId), data);

export const updateUiString = (siteId: string, id: string, data: UpdateUiStringRequest) =>
  apiRequest<UiStringResponse>('PUT', `${base(siteId)}/${id}`, data);

export const deleteUiString = (siteId: string, id: string) =>
  apiRequest<void>('DELETE', `${base(siteId)}/${id}`);
