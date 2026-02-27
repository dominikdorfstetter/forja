import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Typography,
  Stack,
  MenuItem,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { ApiKeyListItem, CreateApiKeyRequest, ApiKeyPermission, ApiKeyStatus, SiteRole } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CreateApiKeyDialog from '@/components/api-keys/CreateApiKeyDialog';
import ApiKeyActionsMenu from '@/components/api-keys/ApiKeyActionsMenu';
import BlockKeyDialog from '@/components/api-keys/BlockKeyDialog';
import ApiKeyUsageDialog from '@/components/api-keys/ApiKeyUsageDialog';

const STATUS_OPTIONS: (ApiKeyStatus | '')[] = ['', 'Active', 'Blocked', 'Expired', 'Revoked'];
const PERMISSION_OPTIONS: (ApiKeyPermission | '')[] = ['', 'Admin', 'Write', 'Read'];

/** Max API key permission a site role can create */
function maxPermissionForRole(role: SiteRole | null, isSysAdmin: boolean): ApiKeyPermission {
  if (isSysAdmin) return 'Admin';
  switch (role) {
    case 'owner': return 'Admin';
    case 'admin': return 'Write';
    default: return 'Read';
  }
}

export default function ApiKeysPage({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { isMaster, isAdmin, currentSiteRole } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [permissionFilter, setPermissionFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockingKey, setBlockingKey] = useState<ApiKeyListItem | null>(null);
  const [revokingKey, setRevokingKey] = useState<ApiKeyListItem | null>(null);
  const [deletingKey, setDeletingKey] = useState<ApiKeyListItem | null>(null);
  const [usageKey, setUsageKey] = useState<ApiKeyListItem | null>(null);

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
  });

  const { data: apiKeysData, isLoading, error } = useQuery({
    queryKey: ['apiKeys', statusFilter, permissionFilter, page, perPage, selectedSiteId],
    queryFn: () => apiService.getApiKeys({
      status: statusFilter || undefined,
      permission: permissionFilter || undefined,
      site_id: isMaster ? undefined : selectedSiteId || undefined,
      page,
      per_page: perPage,
    }),
    enabled: isMaster || !!selectedSiteId,
  });

  const apiKeys = apiKeysData?.data;

  const siteMap = new Map((sites || []).map((s) => [s.id, s.name]));

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiService.blockApiKey(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setBlockingKey(null);
      enqueueSnackbar(t('apiKeys.messages.blocked'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => apiService.unblockApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      enqueueSnackbar(t('apiKeys.messages.unblocked'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiService.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setRevokingKey(null);
      enqueueSnackbar(t('apiKeys.messages.revoked'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setDeletingKey(null);
      enqueueSnackbar(t('apiKeys.messages.deleted'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const handleCreateKey = async (data: CreateApiKeyRequest) => {
    const result = await apiService.createApiKey(data);
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    return result;
  };

  if (isLoading) return <LoadingState label={t('apiKeys.loading')} />;
  if (error) return <Alert severity="error">{t('apiKeys.loadError')}</Alert>;

  return (
    <Box>
      {!embedded && (
        <PageHeader
          title={t('apiKeys.title')}
          subtitle={t('apiKeys.subtitle')}
          action={{ label: t('apiKeys.createButton'), icon: <AddIcon />, onClick: () => setCreateOpen(true), hidden: !isAdmin }}
        />
      )}
      {embedded && isAdmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t('apiKeys.createButton')}
          </Button>
        </Box>
      )}

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label={t('common.filters.status')}
          size="small"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t('apiKeys.filters.allStatuses')}</MenuItem>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('common.filters.permission')}
          size="small"
          value={permissionFilter}
          onChange={(e) => { setPermissionFilter(e.target.value); setPage(1); }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t('apiKeys.filters.allPermissions')}</MenuItem>
          {PERMISSION_OPTIONS.filter(Boolean).map((p) => (
            <MenuItem key={p} value={p}>{p}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {apiKeys && apiKeys.length > 0 ? (
        <>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell scope="col">{t('apiKeys.table.name')}</TableCell>
                <TableCell scope="col">{t('apiKeys.table.keyPrefix')}</TableCell>
                <TableCell scope="col">{t('apiKeys.table.site')}</TableCell>
                <TableCell scope="col">{t('apiKeys.table.permission')}</TableCell>
                <TableCell scope="col">{t('apiKeys.table.status')}</TableCell>
                <TableCell scope="col" align="right">{t('apiKeys.table.requests')}</TableCell>
                <TableCell scope="col">{t('apiKeys.table.lastUsed')}</TableCell>
                <TableCell scope="col" align="right">{t('apiKeys.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">{key.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">{key.key_prefix}...</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {siteMap.get(key.site_id) || key.site_id.slice(0, 8) + '...'}
                    </Typography>
                  </TableCell>
                  <TableCell><StatusChip value={key.permission} /></TableCell>
                  <TableCell><StatusChip value={key.status} /></TableCell>
                  <TableCell align="right">{key.total_requests.toLocaleString()}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {key.last_used_at ? format(new Date(key.last_used_at), 'PP') : t('common.labels.never')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <ApiKeyActionsMenu
                      apiKey={key}
                      onBlock={(k) => setBlockingKey(k)}
                      onUnblock={(k) => unblockMutation.mutate(k.id)}
                      onRevoke={(k) => setRevokingKey(k)}
                      onDelete={(k) => setDeletingKey(k)}
                      onViewUsage={(k) => setUsageKey(k)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {apiKeysData?.meta && (
          <TablePagination
            component="div"
            count={apiKeysData.meta.total_items}
            page={apiKeysData.meta.page - 1}
            onPageChange={(_, p) => setPage(p + 1)}
            rowsPerPage={apiKeysData.meta.page_size}
            onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        )}
        </>
      ) : (
        <EmptyState
          icon={<KeyIcon sx={{ fontSize: 64 }} />}
          title={t('apiKeys.empty.title')}
          description={statusFilter || permissionFilter ? t('apiKeys.empty.filterHint') : t('apiKeys.empty.description')}
          action={!statusFilter && !permissionFilter ? { label: t('apiKeys.createButton'), onClick: () => setCreateOpen(true) } : undefined}
        />
      )}

      <CreateApiKeyDialog
        open={createOpen}
        sites={sites || []}
        maxPermission={maxPermissionForRole(currentSiteRole, isMaster)}
        isSystemAdmin={isMaster}
        onSubmit={handleCreateKey}
        onClose={() => setCreateOpen(false)}
      />

      <BlockKeyDialog
        open={!!blockingKey}
        keyName={blockingKey?.name || ''}
        onConfirm={(reason) => blockingKey && blockMutation.mutate({ id: blockingKey.id, reason })}
        onCancel={() => setBlockingKey(null)}
        loading={blockMutation.isPending}
      />

      <ConfirmDialog
        open={!!revokingKey}
        title={t('apiKeys.revokeDialog.title')}
        message={t('apiKeys.revokeDialog.message', { name: revokingKey?.name })}
        confirmLabel={t('apiKeys.actionsMenu.revoke')}
        confirmColor="warning"
        onConfirm={() => revokingKey && revokeMutation.mutate(revokingKey.id)}
        onCancel={() => setRevokingKey(null)}
        loading={revokeMutation.isPending}
      />

      <ConfirmDialog
        open={!!deletingKey}
        title={t('apiKeys.deleteDialog.title')}
        message={t('apiKeys.deleteDialog.message', { name: deletingKey?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingKey && deleteMutation.mutate(deletingKey.id)}
        onCancel={() => setDeletingKey(null)}
        loading={deleteMutation.isPending}
      />

      <ApiKeyUsageDialog
        open={!!usageKey}
        keyId={usageKey?.id || null}
        keyName={usageKey?.name || ''}
        onClose={() => setUsageKey(null)}
      />
    </Box>
  );
}
