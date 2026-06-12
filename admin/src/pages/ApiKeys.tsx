import { useReducer, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockApiKey, createApiKey, deleteApiKey, getApiKeys, revokeApiKey, unblockApiKey, updateApiKey } from '@/services/apiKeys';
import { getSites } from '@/services/sites';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type {
  ApiKeyListItem,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyPermission,
  ApiKeyStatus,
  SiteRole,
} from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CreateApiKeyDialog from '@/components/api-keys/CreateApiKeyDialog';
import EditApiKeyDialog from '@/components/api-keys/EditApiKeyDialog';
import { ApiKeyActionsMenuV2 } from '@/components/api-keys/ApiKeyActionsMenuV2';
import BlockKeyDialog from '@/components/api-keys/BlockKeyDialog';
import ApiKeyUsageDialog from '@/components/api-keys/ApiKeyUsageDialog';
import KeyIcon from '@mui/icons-material/Key';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  FilterSelect,
} from '@/components/shared/listPageV2';
import { SectionHead, M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';

const STATUS_OPTIONS: (ApiKeyStatus | '')[] = ['', 'Active', 'Blocked', 'Expired', 'Revoked'];
const PERMISSION_OPTIONS: (ApiKeyPermission | '')[] = ['', 'Admin', 'Write', 'Read'];

/** Max API key permission a site role can create */
function maxPermissionForRole(role: SiteRole | null, isSysAdmin: boolean): ApiKeyPermission {
  if (isSysAdmin) return 'Admin';
  switch (role) {
    case 'owner':
      return 'Admin';
    case 'admin':
      return 'Write';
    default:
      return 'Read';
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
  editingKey: ApiKeyListItem | null;
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
  | { type: 'openEdit'; key: ApiKeyListItem }
  | { type: 'closeEdit' }
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
  editingKey: null,
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
    case 'openEdit':
      return { ...state, editingKey: action.key };
    case 'closeEdit':
      return { ...state, editingKey: null };
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

export default function ApiKeysPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const { isMaster, isAdmin, currentSiteRole } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [ui, dispatch] = useReducer(uiReducer, initialUIState);
  const debouncedSearch = useDebouncedValue(ui.searchInput);

  const handleSort = useCallback(
    (column: string) => {
      const newDir = ui.sortBy === column ? (ui.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      dispatch({ type: 'setSort', sortBy: column, sortDir: newDir });
    },
    [ui.sortBy, ui.sortDir],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-api-key') dispatch({ type: 'openCreate' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  const { data: sites } = useQuery({
    queryKey: queryKeys.sites(),
    queryFn: () => getSites(),
  });

  const { data: apiKeysData, isLoading, error } = useQuery({
    queryKey: queryKeys.apiKeys(
      ui.statusFilter,
      ui.permissionFilter,
      debouncedSearch,
      ui.page,
      ui.pageSize,
      selectedSiteId,
      ui.sortBy,
      ui.sortDir,
    ),
    queryFn: () =>
      getApiKeys({
        status: ui.statusFilter || undefined,
        permission: ui.permissionFilter || undefined,
        search: debouncedSearch || undefined,
        site_id: selectedSiteId || undefined,
        page: ui.page,
        page_size: ui.pageSize,
        sort_by: ui.sortBy || undefined,
        sort_dir: ui.sortBy ? ui.sortDir : undefined,
      }),
    enabled: !!selectedSiteId,
  });

  const apiKeys = apiKeysData?.data ?? [];
  const total = apiKeysData?.meta.total_items ?? 0;
  const siteMap = new Map((sites || []).map((s) => [s.id, s.name]));

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      blockApiKey(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      dispatch({ type: 'closeBlock' });
      showSuccess(t('apiKeys.messages.blocked'));
    },
    onError: (error) => {
      showError(error);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => unblockApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      showSuccess(t('apiKeys.messages.unblocked'));
    },
    onError: (error) => {
      showError(error);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      dispatch({ type: 'closeRevoke' });
      showSuccess(t('apiKeys.messages.revoked'));
    },
    onError: (error) => {
      showError(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      dispatch({ type: 'closeDelete' });
      showSuccess(t('apiKeys.messages.deleted'));
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleCreateKey = async (data: CreateApiKeyRequest) => {
    const result = await createApiKey(data);
    queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
    return result;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) =>
      updateApiKey(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      dispatch({ type: 'closeEdit' });
      showSuccess(t('apiKeys.messages.updated'));
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleUpdateKey = async (id: string, data: UpdateApiKeyRequest) => {
    await updateMutation.mutateAsync({ id, data });
  };

  if (isLoading) return <LoadingState label={t('apiKeys.loading')} />;
  if (error) return <Alert severity="error">{t('apiKeys.loadError')}</Alert>;

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    ui.sortBy === key ? ui.sortDir : undefined;

  const columns: DataTableV2Column<ApiKeyListItem>[] = [
    {
      key: 'name',
      label: t('apiKeys.table.name'),
      width: '1.2fr',
      sorted: sortedDir('name'),
      render: (k) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{k.name}</span>,
    },
    {
      key: 'key_prefix',
      label: t('apiKeys.table.keyPrefix'),
      width: '140px',
      muted: true,
      render: (k) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{k.key_prefix}…</span>
      ),
    },
    {
      key: 'site',
      label: t('apiKeys.table.site'),
      width: '160px',
      muted: true,
      render: (k) => siteMap.get(k.site_id) || k.site_id.slice(0, 8) + '…',
    },
    {
      key: 'permission',
      label: t('apiKeys.table.permission'),
      width: '110px',
      sorted: sortedDir('permission'),
      render: (k) => <StatusChip value={k.permission} />,
    },
    {
      key: 'status',
      label: t('apiKeys.table.status'),
      width: '110px',
      sorted: sortedDir('status'),
      render: (k) => <StatusChip value={k.status} />,
    },
    {
      key: 'total_requests',
      label: t('apiKeys.table.requests'),
      width: '100px',
      align: 'right',
      sorted: sortedDir('total_requests'),
      render: (k) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {k.total_requests.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      label: t('apiKeys.table.lastUsed'),
      width: '140px',
      muted: true,
      sorted: sortedDir('last_used_at'),
      render: (k) =>
        k.last_used_at ? fmt(k.last_used_at, 'PP') : t('common.labels.never'),
    },
  ];

  const headerActions = isAdmin ? (
    <M3Button
      size="md"
      icon="add"
      onClick={() => dispatch({ type: 'openCreate' })}
      data-testid="create-api-key"
    >
      {t('apiKeys.createButton')}
    </M3Button>
  ) : undefined;


  return (
    <Box data-testid="api-keys.page">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <SectionHead
          icon="vpn_key"
          title={t('apiKeys.title')}
          subtitle={t('apiKeys.subtitle')}
        />
        {headerActions && <Box sx={{ mt: 0.5 }}>{headerActions}</Box>}
      </Box>

      <Toolbar>
        <SearchField
          value={ui.searchInput}
          onChange={(v) => dispatch({ type: 'setSearchInput', value: v })}
          placeholder={t('apiKeys.searchPlaceholder')}
          data-testid="api-keys-search"
        />
        <FilterSelect
          value={ui.statusFilter}
          onChange={(value) => dispatch({ type: 'setStatusFilter', value })}
          options={STATUS_OPTIONS.filter((s) => s !== '').map((s) => ({ value: s, label: s }))}
          placeholder={t('apiKeys.filters.allStatuses')}
          width={160}
          data-testid="api-keys-status-filter"
        />
        <FilterSelect
          value={ui.permissionFilter}
          onChange={(value) => dispatch({ type: 'setPermissionFilter', value })}
          options={PERMISSION_OPTIONS.filter((p) => p !== '').map((p) => ({ value: p, label: p }))}
          placeholder={t('apiKeys.filters.allPermissions')}
          width={160}
          data-testid="api-keys-permission-filter"
        />
        <ToolbarSpacer />
      </Toolbar>

      {apiKeys.length > 0 ? (
        <>
          <DataTableV2<ApiKeyListItem>
            data-testid="api-keys.table"
            columns={columns}
            rows={apiKeys}
            getKey={(k) => k.id}
            onSort={handleSort}
            renderActions={(k) => (
              <ApiKeyActionsMenuV2
                apiKey={k}
                onEdit={(key) => dispatch({ type: 'openEdit', key })}
                onBlock={(key) => dispatch({ type: 'openBlock', key })}
                onUnblock={(key) => unblockMutation.mutate(key.id)}
                onRevoke={(key) => dispatch({ type: 'openRevoke', key })}
                onDelete={(key) => dispatch({ type: 'openDelete', key })}
                onViewUsage={(key) => dispatch({ type: 'openUsage', key })}
              />
            )}
          />
          {apiKeysData?.meta && (
            <Pagination
              total={total}
              page={ui.page}
              perPage={ui.pageSize}
              onPage={(next) => dispatch({ type: 'setPage', value: next })}
              onPerPage={(next) => dispatch({ type: 'setPageSize', value: next })}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<KeyIcon sx={{ fontSize: 64 }} />}
          title={t('apiKeys.empty.title')}
          description={
            ui.statusFilter || ui.permissionFilter || debouncedSearch
              ? t('apiKeys.empty.filterHint')
              : t('apiKeys.empty.description')
          }
          action={
            !ui.statusFilter && !ui.permissionFilter && !debouncedSearch && isAdmin
              ? { label: t('apiKeys.createButton'), onClick: () => dispatch({ type: 'openCreate' }) }
              : undefined
          }
        />
      )}

      <CreateApiKeyDialog
        open={ui.createOpen}
        siteId={selectedSiteId}
        maxPermission={maxPermissionForRole(currentSiteRole, isMaster)}
        onSubmit={handleCreateKey}
        onClose={() => dispatch({ type: 'closeCreate' })}
      />

      <EditApiKeyDialog
        open={!!ui.editingKey}
        apiKey={ui.editingKey}
        onSubmit={handleUpdateKey}
        onClose={() => dispatch({ type: 'closeEdit' })}
      />

      <BlockKeyDialog
        open={!!ui.blockingKey}
        keyName={ui.blockingKey?.name || ''}
        onConfirm={(reason) =>
          ui.blockingKey && blockMutation.mutate({ id: ui.blockingKey.id, reason })
        }
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
