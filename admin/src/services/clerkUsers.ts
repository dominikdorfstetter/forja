import type {
  ClerkUser,
  ClerkUserListResponse,
  PaginatedAuditLogs,
  UserDataExportResponse,
} from '@/types/api';
import { apiRequest } from './http';

export const getClerkUsers = (params?: { limit?: number; offset?: number }) =>
  apiRequest<ClerkUserListResponse>('GET', '/clerk/users', undefined, { params });

export const getClerkUser = (id: string) =>
  apiRequest<ClerkUser>('GET', `/clerk/users/${id}`);

export const updateClerkUserRole = (userId: string, data: { role: string }) =>
  apiRequest<void>('PUT', `/clerk/users/${userId}/role`, data);

export const getUserAuditLogs = (
  clerkUserId: string,
  params?: { page?: number; page_size?: number },
) => apiRequest<PaginatedAuditLogs>('GET', `/audit/user/${clerkUserId}`, undefined, { params });

export const suspendUser = (
  clerkUserId: string,
  data: { reason: string; duration_hours: number },
) => apiRequest<void>('POST', `/admin/users/${clerkUserId}/suspend`, data);

export const banUser = (clerkUserId: string, data: { reason: string }) =>
  apiRequest<void>('POST', `/admin/users/${clerkUserId}/ban`, data);

export const unsuspendUser = (clerkUserId: string) =>
  apiRequest<void>('POST', `/admin/users/${clerkUserId}/unsuspend`);

export const deleteBannedUser = (clerkUserId: string) =>
  apiRequest<void>('DELETE', `/admin/users/${clerkUserId}`);

export const exportUserDataOnBehalf = (clerkUserId: string) =>
  apiRequest<UserDataExportResponse>('GET', `/admin/users/${clerkUserId}/export`);

export const deleteUserAccountOnBehalf = (clerkUserId: string) =>
  apiRequest<void>('DELETE', `/admin/users/${clerkUserId}/account`);
