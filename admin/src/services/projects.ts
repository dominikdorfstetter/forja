import type {
  ProjectResponse,
  ProjectDetailResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  ReorderItem,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';
import { createContentService } from './contentService';

const svc = createContentService<
  ProjectResponse,
  ProjectDetailResponse,
  ProjectResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  ListQueryParams & { status?: string; is_featured?: boolean }
>({ base: 'projects' });

// Shared CRUD surface (ADR 0003 uniform routes). `getProject` now targets
// `/projects/{id}/detail` in lockstep with the backend route split, so it
// still returns the full relational graph (links/media/cv_entry_ids).
export const getProjects = svc.list;
export const getProject = svc.detail;
export const createProject = svc.create;
export const updateProject = svc.update;
export const deleteProject = svc.remove;
export const reviewProject = svc.review;
export const bulkProjects = svc.bulk;

// Entity-specific extras.
export const getProjectBySlug = (siteId: string, slug: string) =>
  apiRequest<ProjectDetailResponse>('GET', `/sites/${siteId}/projects/by-slug/${slug}`);

export const getPublishedProjects = (
  siteId: string,
  params?: ListQueryParams & { is_featured?: boolean },
) => apiRequest<Paginated<ProjectResponse>>(
  'GET',
  `/sites/${siteId}/projects/public`,
  undefined,
  { params },
);

export const reorderProjects = (siteId: string, items: ReorderItem[]) =>
  apiRequest<void>('POST', `/sites/${siteId}/projects/reorder`, { items });
