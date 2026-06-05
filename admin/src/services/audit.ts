import type {
  AuditLogEntry,
  AiUsageCount,
  ChangeHistoryEntry,
  RevertChangesResponse,
  ListQueryParams,
  Paginated,
} from '@/types/api';
import { apiRequest } from './http';

export const getAuditLogs = (
  siteId: string,
  params?: ListQueryParams & {
    action?: string;
    entity_type?: string;
    from_date?: string;
    to_date?: string;
  },
) => apiRequest<Paginated<AuditLogEntry>>(
  'GET',
  `/sites/${siteId}/audit`,
  undefined,
  { params },
);

export const getAuditAiUsage = (siteId: string) =>
  apiRequest<AiUsageCount>('GET', `/sites/${siteId}/audit/ai-usage`);

export const getEntityAuditLogs = (entityType: string, entityId: string) =>
  apiRequest<AuditLogEntry[]>('GET', `/audit/entity/${entityType}/${entityId}`);

export const getEntityChangeHistory = (entityType: string, entityId: string) =>
  apiRequest<ChangeHistoryEntry[]>('GET', `/audit/history/${entityType}/${entityId}`);

export const revertChanges = (changeIds: string[]) =>
  apiRequest<RevertChangesResponse>('POST', '/audit/history/revert', { change_ids: changeIds });
