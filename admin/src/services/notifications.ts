import type {
  NotificationResponse,
  NotificationStatusCounts,
  NotificationDeleteResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getNotifications = (
  siteId: string,
  params?: ListQueryParams & { is_read?: boolean },
) => apiRequest<Paginated<NotificationResponse>>(
  'GET',
  `/sites/${siteId}/notifications`,
  undefined,
  { params },
);

export const getUnreadCount = (siteId: string) =>
  apiRequest<UnreadCountResponse>('GET', `/sites/${siteId}/notifications/unread-count`);

export const getNotificationStatusCounts = (siteId: string) =>
  apiRequest<NotificationStatusCounts>('GET', `/sites/${siteId}/notifications/status-counts`);

export const markNotificationRead = (id: string) =>
  apiRequest<NotificationResponse>('PUT', `/notifications/${id}/read`);

export const markAllNotificationsRead = (siteId: string) =>
  apiRequest<MarkAllReadResponse>('PUT', `/sites/${siteId}/notifications/read-all`);

export const deleteNotification = (id: string) =>
  apiRequest<NotificationDeleteResponse>('DELETE', `/notifications/${id}`);

export const bulkDeleteNotifications = (siteId: string, ids: string[]) =>
  apiRequest<NotificationDeleteResponse>(
    'POST',
    `/sites/${siteId}/notifications/bulk-delete`,
    { ids },
  );

export const deleteReadNotifications = (siteId: string) =>
  apiRequest<NotificationDeleteResponse>('DELETE', `/sites/${siteId}/notifications/read`);
