import type {
  SkillResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  BulkContentRequest,
  BulkContentResponse,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getSkills = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<SkillResponse>>('GET', `/sites/${siteId}/skills`, undefined, { params });

export const createSkill = (data: CreateSkillRequest) =>
  apiRequest<SkillResponse>('POST', '/skills', data);

export const updateSkill = (id: string, data: UpdateSkillRequest) =>
  apiRequest<SkillResponse>('PUT', `/skills/${id}`, data);

export const deleteSkill = (id: string) =>
  apiRequest<void>('DELETE', `/skills/${id}`);

export const bulkSkills = (siteId: string, data: BulkContentRequest) =>
  apiRequest<BulkContentResponse>('POST', `/sites/${siteId}/skills/bulk`, data);
