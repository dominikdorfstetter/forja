import type {
  Webhook,
  WebhookDelivery,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookStatsResponse,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getWebhooks = (siteId: string, params?: ListQueryParams) =>
  apiRequest<Paginated<Webhook>>(
    'GET',
    `/sites/${siteId}/webhooks`,
    undefined,
    { params },
  );

export const getWebhook = (id: string) =>
  apiRequest<Webhook>('GET', `/webhooks/${id}`);

export const createWebhook = (siteId: string, data: CreateWebhookRequest) =>
  apiRequest<Webhook>('POST', `/sites/${siteId}/webhooks`, data);

export const updateWebhook = (id: string, data: UpdateWebhookRequest) =>
  apiRequest<Webhook>('PUT', `/webhooks/${id}`, data);

export const deleteWebhook = (id: string) =>
  apiRequest<void>('DELETE', `/webhooks/${id}`);

export const testWebhook = (id: string) =>
  apiRequest<WebhookDelivery>('POST', `/webhooks/${id}/test`);

export const getWebhookDeliveries = (id: string, params?: ListQueryParams) =>
  apiRequest<Paginated<WebhookDelivery>>(
    'GET',
    `/webhooks/${id}/deliveries`,
    undefined,
    { params },
  );

export const getWebhookStats = (id: string, window?: string) =>
  apiRequest<WebhookStatsResponse>(
    'GET',
    `/webhooks/${id}/stats`,
    undefined,
    { params: window ? { window } : undefined },
  );
