import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Button,
  Alert,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestoreIcon from '@mui/icons-material/Restore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { getEntityAuditLogs, getEntityChangeHistory, revertChanges } from '@/services/audit';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import type { AuditAction, ChangeHistoryEntry } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Scoped replacement for the historical broad `[entityType]` invalidation:
 * refresh the reverted entity's own detail queries (and, for legal, the
 * active site's list) without touching other sites' caches.
 */
function detailRefreshKeys(
  entityType: string,
  entityId: string,
  siteId: string | undefined,
): readonly (readonly unknown[])[] {
  switch (entityType) {
    case 'site':
      return [queryKeys.site(entityId)];
    case 'blog':
      return [queryKeys.blogDetail(entityId)];
    case 'page':
      return [queryKeys.pageWithLocalizations(entityId), queryKeys.page(entityId)];
    case 'legal':
      return [queryKeys.legalDetail(entityId), queryKeys.legal(siteId)];
    default:
      return [queryKeys.entityList(entityType, siteId)];
  }
}

const ACTION_COLORS: Record<AuditAction, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  Create: 'success',
  Read: 'default',
  Update: 'info',
  Delete: 'error',
  Publish: 'success',
  Unpublish: 'warning',
  Archive: 'warning',
  Restore: 'info',
  Login: 'default',
  Logout: 'default',
  SubmitReview: 'info',
  Approve: 'success',
  RequestChanges: 'warning',
  SettingsUpdate: 'info',
  PermissionDenied: 'error',
  OwnershipTransfer: 'warning',
  Export: 'default',
};

/** System-managed fields that should be hidden from change history */
const SYSTEM_FIELDS = new Set([
  'id', 'content_id', 'site_id', 'created_at', 'updated_at',
  'created_by', 'is_deleted', 'published_at',
]);

/** Group tolerance in milliseconds — changes within 2 seconds are considered one event */
const GROUP_TOLERANCE_MS = 2000;

interface ChangeGroup {
  key: string;
  timestamp: Date;
  changedBy?: string;
  changes: ChangeHistoryEntry[];
}

function groupChangesByTimestamp(changes: ChangeHistoryEntry[]): ChangeGroup[] {
  if (changes.length === 0) return [];

  // Changes are already sorted DESC from backend
  const groups: ChangeGroup[] = [];
  let current: ChangeGroup | null = null;

  for (const change of changes) {
    const ts = new Date(change.changed_at);

    if (
      current &&
      current.changedBy === (change.changed_by ?? undefined) &&
      Math.abs(current.timestamp.getTime() - ts.getTime()) <= GROUP_TOLERANCE_MS
    ) {
      current.changes.push(change);
    } else {
      current = {
        key: change.id,
        timestamp: ts,
        changedBy: change.changed_by ?? undefined,
        changes: [change],
      };
      groups.push(current);
    }
  }

  return groups;
}

interface EntityHistoryPanelProps {
  entityType: string;
  entityId: string;
}

export default function EntityHistoryPanel({ entityType, entityId }: EntityHistoryPanelProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { isAdmin, isMaster } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const canRevert = isAdmin || isMaster;

  const [revertGroup, setRevertGroup] = useState<ChangeGroup | null>(null);

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: queryKeys.entityAudit(entityType, entityId),
    queryFn: () => getEntityAuditLogs(entityType, entityId),
    enabled: !!entityId,
  });

  const { data: changeHistory, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.entityHistory(entityType, entityId),
    queryFn: () => getEntityChangeHistory(entityType, entityId),
    enabled: !!entityId,
  });

  const revertMutation = useMutation({
    mutationFn: (changeIds: string[]) => revertChanges(changeIds),
    onSuccess: () => {
      enqueueSnackbar(t('entityHistory.reverted'), { variant: 'success' });
      setRevertGroup(null);
      // Invalidate both history and entity queries so the page refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.entityAudit(entityType, entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.entityHistory(entityType, entityId) });
      // Refresh the entity detail page, scoped to this entity/site
      detailRefreshKeys(entityType, entityId, selectedSiteId).forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    onError: () => {
      enqueueSnackbar(t('entityHistory.revertFailed'), { variant: 'error' });
    },
  });

  const changeGroups = useMemo(() => {
    const filtered = (changeHistory ?? []).filter(
      (c) => !c.field_name || !SYSTEM_FIELDS.has(c.field_name),
    );
    return groupChangesByTimestamp(filtered);
  }, [changeHistory]);

  const isLoading = logsLoading || historyLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const hasData = (auditLogs && auditLogs.length > 0) || changeGroups.length > 0;

  if (!hasData) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {t('entityHistory.noHistory')}
      </Typography>
    );
  }

  const handleRevertConfirm = () => {
    if (!revertGroup) return;
    revertMutation.mutate(revertGroup.changes.map((c) => c.id));
  };

  return (
    <Box>
      {/* Audit Events */}
      {auditLogs && auditLogs.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('entityHistory.events')}
          </Typography>
          {auditLogs.map((log) => (
            <Box
              key={log.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Chip
                label={log.action}
                size="small"
                color={ACTION_COLORS[log.action] || 'default'}
                variant="outlined"
                sx={{ minWidth: 70 }}
              />
              <Typography variant="caption" color="text.secondary">
                {fmt(log.created_at, 'PPpp')}
              </Typography>
              {log.user_id && (
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                  {log.user_id.slice(0, 8)}...
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Change History — grouped by timestamp */}
      {changeGroups.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('entityHistory.changes')}
          </Typography>
          {changeGroups.map((group) => (
            <Accordion
              key={group.key}
              disableGutters
              elevation={0}
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  {group.changes.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.field_name || '\u2014'}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>
                    {fmt(group.timestamp, 'PPpp')}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {group.changes.map((change) => (
                  <Box key={change.id} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                      {change.field_name || '\u2014'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, fontSize: '0.8rem' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                          {t('entityHistory.oldValue')}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            bgcolor: 'error.50',
                            p: 1,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            overflow: 'auto',
                            maxHeight: 100,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {change.old_value != null ? JSON.stringify(change.old_value, null, 2) : '\u2014'}
                        </Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                          {t('entityHistory.newValue')}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            bgcolor: 'success.50',
                            p: 1,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            overflow: 'auto',
                            maxHeight: 100,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {change.new_value != null ? JSON.stringify(change.new_value, null, 2) : '\u2014'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}

                {canRevert && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<RestoreIcon />}
                      onClick={() => setRevertGroup(group)}
                    >
                      {t('entityHistory.revert')}
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Revert Confirmation Dialog */}
      <FormDialog
        open={!!revertGroup}
        onClose={() => setRevertGroup(null)}
        onSubmit={handleRevertConfirm}
        icon="restore"
        title={t('entityHistory.revertConfirmTitle')}
        submitLabel={t('entityHistory.revert')}
        submitDanger
        submitTestId="entity-history-revert.btn.submit"
        cancelTestId="entity-history-revert.btn.cancel"
        loading={revertMutation.isPending}
        data-testid="entity-history-revert.dialog"
      >
        <Alert severity="warning">
          {t('entityHistory.revertConfirmMessage')}
        </Alert>
        {revertGroup && (
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {revertGroup.changes.map((c) => (
              <li key={c.id}>
                <Typography variant="body2">
                  <strong>{c.field_name}</strong>
                  {' \u2192 '}
                  {c.old_value != null ? JSON.stringify(c.old_value) : 'null'}
                </Typography>
              </li>
            ))}
          </Box>
        )}
      </FormDialog>
    </Box>
  );
}
