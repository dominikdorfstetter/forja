import { useMemo, useState } from 'react';
import {
  Box,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  MenuItem,
  Typography,
  Tooltip,
  Link as MuiLink,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import type { AuditAction } from '@/types/api';

/**
 * Same namespace the backend uses (RFC 4122 DNS namespace) to derive
 * deterministic UUIDs from Clerk user IDs.
 */
const CLERK_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
};

/** Maps entity_type to a human-readable label */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  page: 'Page',
  media: 'Media',
  document: 'Document',
  navigation_item: 'Nav Item',
  navigation_menu: 'Nav Menu',
  legal_document: 'Legal Doc',
  cv_entry: 'CV Entry',
  skill: 'Skill',
  social_link: 'Social Link',
  tag: 'Tag',
  category: 'Category',
  site: 'Site',
  api_key: 'API Key',
  member: 'Member',
};

/** Maps entity_type to a detail page route (only types that have one) */
const ENTITY_DETAIL_ROUTES: Record<string, string> = {
  blog: '/blogs',
  page: '/pages',
  site: '/sites',
  legal_document: '/legal',
};

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS);

const ACTION_TYPES: AuditAction[] = [
  'Create', 'Update', 'Delete', 'Publish', 'Unpublish', 'Archive', 'Restore',
];

export default function ActivityLogPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', selectedSiteId, page, rowsPerPage],
    queryFn: () => apiService.getAuditLogs(selectedSiteId, { page: page + 1, per_page: rowsPerPage }),
    enabled: !!selectedSiteId,
  });

  // Fetch Clerk users to resolve user_id → full name
  const { data: clerkUsers } = useQuery({
    queryKey: ['clerk-users'],
    queryFn: () => apiService.getClerkUsers({ limit: 200 }),
  });

  // Build a map: internal UUID (v5 of clerk_user_id) → display name
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!clerkUsers?.data) return map;
    for (const user of clerkUsers.data) {
      const internalUuid = uuidv5(user.id, CLERK_UUID_NAMESPACE);
      map.set(internalUuid, user.name || user.email || user.id);
    }
    return map;
  }, [clerkUsers]);

  if (!selectedSiteId) {
    return (
      <Box>
        <PageHeader title={t('activity.title')} subtitle={t('activity.subtitle')} />
        <Alert severity="info">{t('common.noSiteSelected')}</Alert>
      </Box>
    );
  }

  const filteredData = (data?.data || []).filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (entityFilter && log.entity_type !== entityFilter) return false;
    return true;
  });

  return (
    <Box>
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        breadcrumbs={[{ label: t('activity.title') }]}
      />

      <Paper sx={{ mb: 2, p: 2, display: 'flex', gap: 2 }}>
        <TextField
          select
          size="small"
          label={t('activity.filters.action')}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">{t('common.filters.all')}</MenuItem>
          {ACTION_TYPES.map((a) => (
            <MenuItem key={a} value={a}>{a}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('activity.filters.entityType')}
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t('common.filters.all')}</MenuItem>
          {ENTITY_TYPES.map((et) => (
            <MenuItem key={et} value={et}>{ENTITY_TYPE_LABELS[et] || et}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {isLoading ? (
        <LoadingState label={t('activity.loading')} />
      ) : filteredData.length === 0 ? (
        <EmptyState title={t('activity.empty')} description={t('activity.emptyDescription')} />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('activity.columns.timestamp')}</TableCell>
                  <TableCell>{t('activity.columns.userId')}</TableCell>
                  <TableCell>{t('activity.columns.action')}</TableCell>
                  <TableCell>{t('activity.columns.entityType')}</TableCell>
                  <TableCell>{t('activity.columns.entityId')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((log) => {
                  const detailRoute = ENTITY_DETAIL_ROUTES[log.entity_type];
                  const fullDate = format(new Date(log.created_at), 'PPpp');
                  const relativeDate = formatDistanceToNow(new Date(log.created_at), { addSuffix: true });
                  const userName = log.user_id ? userNameMap.get(log.user_id) : null;

                  return (
                    <TableRow key={log.id} hover>
                      {/* Timestamp — relative with full date on hover */}
                      <TableCell>
                        <Tooltip title={fullDate} arrow>
                          <Typography variant="body2" color="text.secondary">
                            {relativeDate}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      {/* User — resolved name */}
                      <TableCell>
                        <Typography variant="body2">
                          {userName || '—'}
                        </Typography>
                      </TableCell>

                      {/* Action */}
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={ACTION_COLORS[log.action] || 'default'}
                          variant="outlined"
                        />
                      </TableCell>

                      {/* Entity Type — human-readable */}
                      <TableCell>
                        <Typography variant="body2">
                          {ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}
                        </Typography>
                      </TableCell>

                      {/* Entity ID — truncated, linked to detail page when available */}
                      <TableCell>
                        <Tooltip title={log.entity_id} arrow>
                          {detailRoute && log.action !== 'Delete' ? (
                            <MuiLink
                              component={RouterLink}
                              to={`${detailRoute}/${log.entity_id}`}
                              variant="body2"
                              fontFamily="monospace"
                              fontSize="0.75rem"
                            >
                              {log.entity_id.slice(0, 8)}
                            </MuiLink>
                          ) : (
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                              {log.entity_id.slice(0, 8)}
                            </Typography>
                          )}
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.meta?.total_items || 0}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}
    </Box>
  );
}
