import type {
  BlogListItem,
  BlogStatusCounts,
  BlogDetailResponse,
  BlogResponse,
  CreateBlogRequest,
  UpdateBlogRequest,
  ListQueryParams,
} from '@/types/api';
import { apiRequest } from './http';
import { createContentService } from './contentService';

const svc = createContentService<
  BlogListItem,
  BlogDetailResponse,
  BlogResponse,
  CreateBlogRequest,
  UpdateBlogRequest,
  ListQueryParams & { status?: string; exclude_status?: string }
>({ base: 'blogs' });

// Shared CRUD surface (ADR 0003 uniform routes).
export const getBlogs = svc.list;
export const getBlogDetail = svc.detail;
export const createBlog = svc.create;
export const updateBlog = svc.update;
export const deleteBlog = svc.remove;
export const bulkBlogs = svc.bulk;
export const reviewBlog = svc.review;
export const getBlogLocalizations = svc.getLocalizations;
export const createBlogLocalization = svc.createLocalization;
export const updateBlogLocalization = svc.updateLocalization;
export const deleteBlogLocalization = svc.deleteLocalization;

// Entity-specific extras.
export const getBlogStatusCounts = (siteId: string) =>
  apiRequest<BlogStatusCounts>('GET', `/sites/${siteId}/blogs/status-counts`);

export const cloneBlog = (id: string) =>
  apiRequest<BlogResponse>('POST', `/blogs/${id}/clone`);

export const getSimilarBlogs = (siteId: string, blogId: string, limit?: number) => {
  const params = limit !== undefined ? `?limit=${limit}` : '';
  return apiRequest<BlogListItem[]>('GET', `/sites/${siteId}/blogs/${blogId}/similar${params}`);
};

export const seedSampleContent = (siteId: string) =>
  apiRequest<BlogResponse[]>('POST', `/sites/${siteId}/blogs/seed`);

export const deleteSampleContent = (siteId: string) =>
  apiRequest<{ deleted: number }>('DELETE', `/sites/${siteId}/blogs/samples`);
