import { useReducer, useEffect, useCallback } from 'react';
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
  TableSortLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { ApiKeyListItem, CreateApiKeyRequest, ApiKeyPermission, ApiKeyStatus, SiteRole } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import TableFilterBar from '@/components/shared/TableFilterBar';
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

interface UIState {
  statusFilter: string;
  permissionFilter: string;
  searchInput: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  createOpen: boolean;
  blockingKey: ApiKeyListItem | null;
  revokingKey: ApiKeyListItem | null;
  deletingKey: ApiKeyListItem | null;
  usageKey: ApiKeyListItem | null;
}

type UIAction =
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setPermissionFilter'; value: string }
  | { type: 'setSearchInput'; value: string }
  | { type: 'setPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'setSort'; sortBy: string; sortDir: 'asc' | 'desc' }
  | { type: 'openCreate' }
  | { type: 'closeCreate' }
  | { type: 'openBlock'; key: ApiKeyListItem }
  | { type: 'closeBlock' }
  | { type: 'openRevoke'; key: ApiKeyListItem }
  | { type: 'closeRevoke' }
  | { type: 'openDelete'; key: ApiKeyListItem }
  | { type: 'closeDelete' }
  | { type: 'openUsage'; key: ApiKeyListItem }
  | { type: 'closeUsage' };

const initialUIState: UIState = {
  statusFilter: '',
  permissionFilter: '',
  searchInput: '',
  sortBy: '',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
  createOpen: false,
  blockingKey: null,
  revokingKey: null,
  deletingKey: null,
  usageKey: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value, page: 1 };
    case 'setPermissionFilter':
      return { ...state, permissionFilter: action.value, page: 1 };
    case 'setSearchInput':
      return { ...state, searchInput: action.value, page: 1 };
    case 'setPage':
      return { ...state, page: action.value };
    case 'setPageSize':
      return { ...state, pageSize: action.value, page: 1 };
    case 'setSort':
      return { ...state, sortBy: action.sortBy, sortDir: action.sortDir, page: 1 };
    case 'openCreate':
      return { ...state, createOpen: true };
    case 'closeCreate':
      return { ...state, createOpen: false };
    case 'openBlock':
      return { ...state, blockingKey: action.key };
    case 'closeBlock':
      return { ...state, blockingKey: null };
    case 'openRevoke':
      return { ...state, revokingKey: action.key };
    case 'closeRevoke':
      return { ...state, revokingKey: null };
    case 'openDelete':
      return { ...state, deletingKey: action.key };
    case 'closeDelete':
      return { ...state, deletingKey: null };
    case 'openUsage':
      return { ...state, usageKey: action.key };
    case 'closeUsage':
      return { ...state, usageKey: null };
    default:
      return state;
  }
}

export default function ApiKeysPage({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const { isMaster, isAdmin, currentSiteRole } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [ui, dispatch] = useReducer(uiReducer, initialUIState);
  const debouncedSearch = useDebouncedValue(ui.searchInput);

  const handleSort = useCallback((column: string) => {
    const newDir = ui.sortBy === column ? (ui.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    dispatch({ type: 'setSort', sortBy: column, sortDir: newDir });
  }, [ui.sortBy, ui.sortDir]);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-api-key') dispatch({ type: 'openCreate' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
  });

  const { data: apiKeysData, isLoading, error } = useQuery({
    queryKey: ['apiKeys', ui.statusFilter, ui.permissionFilter, debouncedSearch, ui.page, ui.pageSize, selectedSiteId, ui.sortBy, ui.sortDir],
    queryFn: () => apiService.getApiKeys({
      status: ui.statusFilter || undefined,
      permission: ui.permissionFilter || undefined,
      search: debouncedSearch || undefined,
      site_id: isMaster ? undefined : selectedSiteId || undefined,
      page: ui.page,
      page_size: ui.pageSize,
      sort_by: ui.sortBy || undefined,
      sort_dir: ui.sortBy ? ui.sortDir : undefined,
    }),
    enabled: isMaster || !!selectedSiteId,
  });

  const apiKeys = apiKeysData?.data;

  const siteMap = new Map((sites || []).map((s) => [s.id, s.name]));

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiService.blockApiKey(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      dispatch({ type: 'closeBlock' });
      showSuccess(t('apiKeys.messages.blocked'));
    },
    onError: (error) => { showError(error); },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => apiService.unblockApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      showSuccess(t('apiKeys.messages.unblocked'));
    },
    onError: (error) => { showError(error); },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiService.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      dispatch({ type: 'closeRevoke' });
      showSuccess(t('apiKeys.messages.revoked'));
    },
    onError: (error) => { showError(error); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      dispatch({ type: 'closeDelete' });
      showSuccess(t('apiKeys.messages.deleted'));
    },
    onError: (error) => { showError(error); },
  });

  const handleCreateKey = async (data: CreateApiKeyRequest) => {
    const result = await apiService.createApiKey(data);
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    return result;
  };

  if (isLoading) return <LoadingState label={t('apiKeys.loading')} />;
  if (error) return <Alert severity="error">{t('apiKeys.loadError')}</Alert>;

  return (
    <Box data-testid="api-keys.page">
      {!embedded && (
        <PageHeader
          title={t('apiKeys.title')}
          subtitle={t('apiKeys.subtitle')}
          action={{ label: t('apiKeys.createButton'), icon: <AddIcon />, onClick: () => dispatch({ type: 'openCreate' }), hidden: !isAdmin }}
        />
      )}
      {embedded && isAdmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => dispatch({ type: 'openCreate' })}>
            {t('apiKeys.createButton')}
          </Button>
        </Box>
      )}

      <Paper>
        <TableFilterBar
          searchValue={ui.searchInput}
          onSearchChange={(v) => dispatch({ type: 'setSearchInput', value: v })}
          searchPlaceholder={t('apiKeys.searchPlaceholder')}
          filters={[
            {
              key: 'status',
              label: t('common.filters.status'),
              value: ui.statusFilter,
              onChange: (v) => dispatch({ type: 'setStatusFilter', value: v }),
              options: [
                { value: '', label: t('apiKeys.filters.allStatuses') },
                ...STATUS_OPTIONS.filter(Boolean).map((s) => ({ value: s, label: s })),
              ],
            },
            {
              key: 'permission',
              label: t('common.filters.permission'),
              value: ui.permissionFilter,
              onChange: (v) => dispatch({ type: 'setPermissionFilter', value: v }),
              options: [
                { value: '', label: t('apiKeys.filters.allPermissions') },
                ...PERMISSION_OPTIONS.filter(Boolean).map((s) => ({ value: s, label: s })),
              ],
            },
          ]}
        />
        {apiKeys && apiKeys.length > 0 ? (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">
                      <TableSortLabel active={ui.sortBy === 'name'} direction={ui.sortBy === 'name' ? ui.sortDir : 'asc'} onClick={() => handleSort('name')}>
                        {t('apiKeys.table.name')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell scope="col">{t('apiKeys.table.keyPrefix')}</TableCell>
                    <TableCell scope="col">{t('apiKeys.table.site')}</TableCell>
                    <TableCell scope="col">
                      <TableSortLabel active={ui.sortBy === 'permission'} direction={ui.sortBy === 'permission' ? ui.sortDir : 'asc'} onClick={() => handleSort('permission')}>
                        {t('apiKeys.table.permission')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell scope="col">
                      <TableSortLabel active={ui.sortBy === 'status'} direction={ui.sortBy === 'status' ? ui.sortDir : 'asc'} onClick={() => handleSort('status')}>
                        {t('apiKeys.table.status')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell scope="col" align="right">
                      <TableSortLabel active={ui.sortBy === 'total_requests'} direction={ui.sortBy === 'total_requests' ? ui.sortDir : 'asc'} onClick={() => handleSort('total_requests')}>
                        {t('apiKeys.table.requests')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell scope="col">
                      <TableSortLabel active={ui.sortBy === 'last_used_at'} direction={ui.sortBy === 'last_used_at' ? ui.sortDir : 'asc'} onClick={() => handleSort('last_used_at')}>
                        {t('apiKeys.table.lastUsed')}
                      </TableSortLabel>
                    </TableCell>
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
                          onBlock={(k) => dispatch({ type: 'openBlock', key: k })}
                          onUnblock={(k) => unblockMutation.mutate(k.id)}
                          onRevoke={(k) => dispatch({ type: 'openRevoke', key: k })}
                          onDelete={(k) => dispatch({ type: 'openDelete', key: k })}
                          onViewUsage={(k) => dispatch({ type: 'openUsage', key: k })}
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
                onPageChange={(_, p) => dispatch({ type: 'setPage', value: p + 1 })}
                rowsPerPage={apiKeysData.meta.page_size}
                onRowsPerPageChange={(e) => dispatch({ type: 'setPageSize', value: +e.target.value })}
                rowsPerPageOptions={[10, 25, 50]}
              />
            )}
          </>
        ) : (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<KeyIcon sx={{ fontSize: 64 }} />}
              title={t('apiKeys.empty.title')}
              description={ui.statusFilter || ui.permissionFilter || debouncedSearch ? t('apiKeys.empty.filterHint') : t('apiKeys.empty.description')}
              action={!ui.statusFilter && !ui.permissionFilter && !debouncedSearch ? { label: t('apiKeys.createButton'), onClick: () => dispatch({ type: 'openCreate' }) } : undefined}
            />
          </Box>
        )}
      </Paper>

      <CreateApiKeyDialog
        open={ui.createOpen}
        sites={sites || []}
        maxPermission={maxPermissionForRole(currentSiteRole, isMaster)}
        isSystemAdmin={isMaster}
        onSubmit={handleCreateKey}
        onClose={() => dispatch({ type: 'closeCreate' })}
      />

      <BlockKeyDialog
        open={!!ui.blockingKey}
        keyName={ui.blockingKey?.name || ''}
        onConfirm={(reason) => ui.blockingKey && blockMutation.mutate({ id: ui.blockingKey.id, reason })}
        onCancel={() => dispatch({ type: 'closeBlock' })}
        loading={blockMutation.isPending}
      />

      <ConfirmDialog
        open={!!ui.revokingKey}
        title={t('apiKeys.revokeDialog.title')}
        message={t('apiKeys.revokeDialog.message', { name: ui.revokingKey?.name })}
        confirmLabel={t('apiKeys.actionsMenu.revoke')}
        confirmColor="warning"
        onConfirm={() => ui.revokingKey && revokeMutation.mutate(ui.revokingKey.id)}
        onCancel={() => dispatch({ type: 'closeRevoke' })}
        loading={revokeMutation.isPending}
        confirmationText={t('apiKeys.revokeDialog.confirmWord')}
      />

      <ConfirmDialog
        open={!!ui.deletingKey}
        title={t('apiKeys.deleteDialog.title')}
        message={t('apiKeys.deleteDialog.message', { name: ui.deletingKey?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => ui.deletingKey && deleteMutation.mutate(ui.deletingKey.id)}
        onCancel={() => dispatch({ type: 'closeDelete' })}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />

      <ApiKeyUsageDialog
        open={!!ui.usageKey}
        keyId={ui.usageKey?.id || null}
        keyName={ui.usageKey?.name || ''}
        onClose={() => dispatch({ type: 'closeUsage' })}
      />
    </Box>
  );
}
