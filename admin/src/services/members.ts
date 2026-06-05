import type {
  SiteMembership,
  AddSiteMemberRequest,
  UpdateMemberRoleRequest,
  TransferOwnershipRequest,
} from '@/types/api';
import { apiRequest } from './http';

export const getSiteMembers = (siteId: string) =>
  apiRequest<SiteMembership[]>('GET', `/sites/${siteId}/members`);

export const addSiteMember = (siteId: string, data: AddSiteMemberRequest) =>
  apiRequest<SiteMembership>('POST', `/sites/${siteId}/members`, data);

export const updateMemberRole = (
  siteId: string,
  memberId: string,
  data: UpdateMemberRoleRequest,
) => apiRequest<SiteMembership>('PUT', `/sites/${siteId}/members/${memberId}/role`, data);

export const removeSiteMember = (siteId: string, memberId: string) =>
  apiRequest<void>('DELETE', `/sites/${siteId}/members/${memberId}`);

export const transferOwnership = (siteId: string, data: TransferOwnershipRequest) =>
  apiRequest<void>('POST', `/sites/${siteId}/transfer-ownership`, data);
