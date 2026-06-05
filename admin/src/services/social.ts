import type {
  SocialLink,
  CreateSocialLinkRequest,
  UpdateSocialLinkRequest,
  ReorderItem,
} from '@/types/api';
import { apiRequest } from './http';

export const getSocialLinks = (siteId: string) =>
  apiRequest<SocialLink[]>('GET', `/sites/${siteId}/social`);

export const createSocialLink = (siteId: string, data: CreateSocialLinkRequest) =>
  apiRequest<SocialLink>('POST', `/sites/${siteId}/social`, data);

export const updateSocialLink = (id: string, data: UpdateSocialLinkRequest) =>
  apiRequest<SocialLink>('PUT', `/social/${id}`, data);

export const deleteSocialLink = (id: string) =>
  apiRequest<void>('DELETE', `/social/${id}`);

export const reorderSocialLinks = (siteId: string, items: ReorderItem[]) =>
  apiRequest<void>('POST', `/sites/${siteId}/social/reorder`, { items });
