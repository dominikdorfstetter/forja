import type {
  Tag,
  Category,
  CategoryWithCount,
  CreateTagRequest,
  UpdateTagRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  AssignTagRequest,
  AssignCategoryRequest,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getTags = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<Tag>>('GET', `/sites/${siteId}/tags`, undefined, { params });

export const getCategories = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<Category>>('GET', `/sites/${siteId}/categories`, undefined, { params });

export const createTag = (data: CreateTagRequest) =>
  apiRequest<Tag>('POST', '/tags', data);

export const updateTag = (id: string, data: UpdateTagRequest) =>
  apiRequest<Tag>('PUT', `/tags/${id}`, data);

export const deleteTag = (id: string) =>
  apiRequest<void>('DELETE', `/tags/${id}`);

export const createCategory = (data: CreateCategoryRequest) =>
  apiRequest<Category>('POST', '/categories', data);

export const updateCategory = (id: string, data: UpdateCategoryRequest) =>
  apiRequest<Category>('PUT', `/categories/${id}`, data);

export const deleteCategory = (id: string) =>
  apiRequest<void>('DELETE', `/categories/${id}`);

export const assignCategoryToContent = (contentId: string, data: AssignCategoryRequest) =>
  apiRequest<void>('POST', `/content/${contentId}/categories`, data);

export const removeCategoryFromContent = (contentId: string, categoryId: string) =>
  apiRequest<void>('DELETE', `/content/${contentId}/categories/${categoryId}`);

export const assignTagToContent = (contentId: string, data: AssignTagRequest) =>
  apiRequest<void>('POST', `/content/${contentId}/tags`, data);

export const removeTagFromContent = (contentId: string, tagId: string) =>
  apiRequest<void>('DELETE', `/content/${contentId}/tags/${tagId}`);

export const getCategoriesWithBlogCount = (siteId: string) =>
  apiRequest<CategoryWithCount[]>('GET', `/sites/${siteId}/categories/blog-counts`);
