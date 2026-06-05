import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Alert, Tabs, Tab } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import type { ContentStatus, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  pageTabsSx,
  Pagination,
} from '@/components/shared/listPageV2';
import { Chip } from '@/components/design-system';
import { useListPageState } from '@/hooks/useListPageState';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type {
  EntityListPageProps,
  ListQueryParams,
  RowDialogActions,
  RowDialogState,
  SortDir,
} from './types';

interface UIState<TItem> {
  viewTab: 'active' | 'archived';
  searchQuery: string;
  statusFilter: string;
  sortBy: string;
  sortDir: SortDir;
  publishingItem: TItem | null;
  unpublishingItem: TItem | null;
  archivingItem: TItem | null;
  restoringItem: TItem | null;
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
}

type UIAction<TItem> =
  | { type: 'setViewTab'; value: 'active' | 'archived' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setSort'; sortBy: string; sortDir: SortDir }
  | { type: 'openPublish'; item: TItem }
  | { type: 'closePublish' }
  | { type: 'openUnpublish'; item: TItem }
  | { type: 'closeUnpublish' }
  | { type: 'openArchive'; item: TItem }
  | { type: 'closeArchive' }
  | { type: 'openRestore'; item: TItem }
  | { type: 'closeRestore' }
  | { type: 'openBulkDelete' }
  | { type: 'openBulkPublish' }
  | { type: 'openBulkUnpublish' }
  | { type: 'openBulkArchive' }
  | { type: 'openBulkRestore' }
  | { type: 'closeAllBulk' };

function makeReducer<TItem>(defaultSort: { sortBy: string; sortDir: SortDir }) {
  const initial: UIState<TItem> = {
    viewTab: 'active',
    searchQuery: '',
    statusFilter: '',
    sortBy: defaultSort.sortBy,
    sortDir: defaultSort.sortDir,
    publishingItem: null,
    unpublishingItem: null,
    archivingItem: null,
    restoringItem: null,
    bulkDeleteOpen: false,
    bulkPublishOpen: false,
    bulkUnpublishOpen: false,
    bulkArchiveOpen: false,
    bulkRestoreOpen: false,
  };

  function reducer(state: UIState<TItem>, action: UIAction<TItem>): UIState<TItem> {
    switch (action.type) {
      case 'setViewTab':
        return { ...state, viewTab: action.value, statusFilter: '', searchQuery: '' };
      case 'setSearchQuery':
        return { ...state, searchQuery: action.value };
      case 'setStatusFilter':
        return { ...state, statusFilter: action.value };
      case 'setSort':
        return { ...state, sortBy: action.sortBy, sortDir: action.sortDir };
      case 'openPublish':
        return { ...state, publishingItem: action.item };
      case 'closePublish':
        return { ...state, publishingItem: null };
      case 'openUnpublish':
        return { ...state, unpublishingItem: action.item };
      case 'closeUnpublish':
        return { ...state, unpublishingItem: null };
      case 'openArchive':
        return { ...state, archivingItem: action.item };
      case 'closeArchive':
        return { ...state, archivingItem: null };
      case 'openRestore':
        return { ...state, restoringItem: action.item };
      case 'closeRestore':
        return { ...state, restoringItem: null };
      case 'openBulkDelete':
        return { ...state, bulkDeleteOpen: true };
      case 'openBulkPublish':
        return { ...state, bulkPublishOpen: true };
      case 'openBulkUnpublish':
        return { ...state, bulkUnpublishOpen: true };
      case 'openBulkArchive':
        return { ...state, bulkArchiveOpen: true };
      case 'openBulkRestore':
        return { ...state, bulkRestoreOpen: true };
      case 'closeAllBulk':
        return {
          ...state,
          bulkDeleteOpen: false,
          bulkPublishOpen: false,
          bulkUnpublishOpen: false,
          bulkArchiveOpen: false,
          bulkRestoreOpen: false,
        };
      default:
        return state;
    }
  }

  return { reducer, initial };
}

function SlotRender<TArgs>({ render, args }: { render: (a: TArgs) => ReactNode; args: TArgs }): ReactNode {
  return render(args);
}

export default function EntityListPage<TItem, TStatusCounts = void>({
  adapter,
  renderRowActions,
  renderDialogs,
  renderHeaderActions,
  renderToolbarExtras,
  renderEmptyState,
  renderCreateForm,
  extraQueryParams,
  extraQueryDeps,
}: EntityListPageProps<TItem, TStatusCounts>) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, enqueueSnackbar, showSuccess } = useErrorSnackbar();
  const { context } = useSiteContextData();
  const workflowEnabled = context.features.editorial_workflow;

  // Resolve list-chrome copy by convention under `<i18nNamespace>.list.*`.
  const tl = useCallback(
    (sub: string, opts?: Record<string, unknown>) => t(`${adapter.i18nNamespace}.list.${sub}`, opts),
    [t, adapter.i18nNamespace],
  );

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    formOpen,
    deleting: deletingItem,
    openCreate,
    closeForm,
    openDelete,
    closeDelete,
  } = useListPageState<TItem>();

  const { reducer, initial } = useMemo(() => makeReducer<TItem>(adapter.defaultSort), [adapter.defaultSort]);
  const [ui, dispatch] = useReducer(reducer, initial);

  const debouncedSearch = useDebouncedValue(ui.searchQuery);

  // Reset page to 1 when debounced search changes (skip mount).
  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch, setPage]);

  const isArchived = ui.viewTab === 'archived';

  const queryParams = useMemo<ListQueryParams>(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status: isArchived ? ('Archived' as ContentStatus) : (ui.statusFilter as ContentStatus) || undefined,
      sort_by: ui.sortBy,
      sort_dir: ui.sortDir,
      exclude_status: isArchived ? undefined : ('Archived' as ContentStatus),
      ...extraQueryParams,
    }),
    [page, pageSize, debouncedSearch, isArchived, ui.statusFilter, ui.sortBy, ui.sortDir, extraQueryParams],
  );

  const { data: listData, isLoading, error } = useQuery({
    queryKey: [...adapter.listQueryKey(selectedSiteId, queryParams), ...(extraQueryDeps ?? [])],
    queryFn: () => adapter.fetchList(selectedSiteId, queryParams),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const { data: statusCounts } = useQuery({
    queryKey: adapter.statusCountsQueryKey?.(selectedSiteId) ?? [`__no-counts-${adapter.entityKey}`],
    queryFn: () => adapter.fetchStatusCounts!(selectedSiteId),
    enabled: !!selectedSiteId && !!adapter.fetchStatusCounts,
    placeholderData: keepPreviousData,
  });

  const items = listData?.data ?? [];
  const total = listData?.meta.total_items ?? 0;
  const itemIds = items.map((item) => adapter.getItemId(item));

  const bulk = useBulkSelection([page, pageSize, listData]);

  // Hydrate viewTab from URL ?tab=archived
  const urlTab = searchParams.get('tab') === 'archived' ? 'archived' : 'active';
  useEffect(() => {
    if (ui.viewTab !== urlTab) {
      dispatch({ type: 'setViewTab', value: urlTab });
      setPage(1);
      bulk.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: 'active' | 'archived') => {
      setSearchParams(newValue === 'archived' ? { tab: 'archived' } : {}, { replace: true });
    },
    [setSearchParams],
  );

  const handleSort = useCallback(
    (column: string) => {
      const nextDir: SortDir =
        ui.sortBy === column ? (ui.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      dispatch({ type: 'setSort', sortBy: column, sortDir: nextDir });
      setPage(1);
    },
    [ui.sortBy, ui.sortDir, setPage],
  );

  const handleChipFilterChange = useCallback(
    (value: string) => {
      dispatch({ type: 'setStatusFilter', value: value === 'all' ? '' : value });
      setPage(1);
    },
    [setPage],
  );

  const queryKeyRoot = adapter.queryKeyRoot ?? adapter.entityKey + 's';

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      adapter.updateEntity(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyRoot] });
      adapter.bulkExtraInvalidations?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      if (adapter.statusCountsQueryKey) {
        queryClient.invalidateQueries({ queryKey: adapter.statusCountsQueryKey(selectedSiteId) });
      }
      showSuccess(tl('messages.updated'));
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adapter.deleteEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyRoot] });
      adapter.bulkExtraInvalidations?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      if (adapter.statusCountsQueryKey) {
        queryClient.invalidateQueries({ queryKey: adapter.statusCountsQueryKey(selectedSiteId) });
      }
      closeDelete();
      showSuccess(tl('messages.deleted'));
    },
    onError: (err) => showError(err),
  });

  const bulkMutation = useMutation({
    mutationFn: (request: BulkContentRequest) => adapter.bulkAction(selectedSiteId, request),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: [queryKeyRoot] });
      adapter.bulkExtraInvalidations?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      if (adapter.statusCountsQueryKey) {
        queryClient.invalidateQueries({ queryKey: adapter.statusCountsQueryKey(selectedSiteId) });
      }
      bulk.clear();
      dispatch({ type: 'closeAllBulk' });
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), {
          variant: 'warning',
        });
      }
    },
    onError: (err) => showError(err),
  });

  // Bulk handlers
  const onRowConfirmStatus = useCallback(
    (item: TItem, status: ContentStatus) => {
      updateMutation.mutate({ id: adapter.getItemId(item), status });
    },
    [adapter, updateMutation],
  );

  const onRowConfirmDelete = useCallback(
    (item: TItem) => {
      deleteMutation.mutate(adapter.getItemId(item));
    },
    [adapter, deleteMutation],
  );

  const onBulkConfirm = useCallback(
    (action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete') => {
      const ids = [...bulk.selectedIds];
      if (action === 'delete') {
        bulkMutation.mutate({ ids, action: 'Delete' });
      } else {
        const status: ContentStatus =
          action === 'publish' ? 'Published' : action === 'archive' ? 'Archived' : 'Draft';
        bulkMutation.mutate({ ids, action: 'UpdateStatus', status });
      }
    },
    [bulk.selectedIds, bulkMutation],
  );

  // Slot data
  const rowActions: RowDialogActions<TItem> = useMemo(
    () => ({
      openPublish: (item) => dispatch({ type: 'openPublish', item }),
      openUnpublish: (item) => dispatch({ type: 'openUnpublish', item }),
      openArchive: (item) => dispatch({ type: 'openArchive', item }),
      openRestore: (item) => dispatch({ type: 'openRestore', item }),
      closePublish: () => dispatch({ type: 'closePublish' }),
      closeUnpublish: () => dispatch({ type: 'closeUnpublish' }),
      closeArchive: () => dispatch({ type: 'closeArchive' }),
      closeRestore: () => dispatch({ type: 'closeRestore' }),
    }),
    [],
  );

  const rowState: RowDialogState<TItem> = {
    publishingItem: ui.publishingItem,
    unpublishingItem: ui.unpublishingItem,
    archivingItem: ui.archivingItem,
    restoringItem: ui.restoringItem,
  };

  const bulkActions = useMemo(
    () => ({
      openBulkPublish: () => dispatch({ type: 'openBulkPublish' }),
      openBulkUnpublish: () => dispatch({ type: 'openBulkUnpublish' }),
      openBulkArchive: () => dispatch({ type: 'openBulkArchive' }),
      openBulkRestore: () => dispatch({ type: 'openBulkRestore' }),
      openBulkDelete: () => dispatch({ type: 'openBulkDelete' }),
      closeAllBulk: () => dispatch({ type: 'closeAllBulk' }),
    }),
    [],
  );

  const bulkState = {
    bulkDeleteOpen: ui.bulkDeleteOpen,
    bulkPublishOpen: ui.bulkPublishOpen,
    bulkUnpublishOpen: ui.bulkUnpublishOpen,
    bulkArchiveOpen: ui.bulkArchiveOpen,
    bulkRestoreOpen: ui.bulkRestoreOpen,
  };

  const chipOptions = adapter.buildChipFilters({ t, workflowEnabled, counts: statusCounts });
  const activeChip = ui.statusFilter || 'all';

  const columns = adapter.buildColumns({ t, fmt, sortBy: ui.sortBy, sortDir: ui.sortDir });

  const selected = new Set(bulk.selectedIds);
  const onToggleSelect = (id: string) => bulk.toggle(id);
  const onToggleAll = (next: boolean) => {
    if (next) bulk.selectAll(itemIds);
    else bulk.clear();
  };

  const breadcrumb = t('layout.sidebar.content') + ' / ' + tl('breadcrumb');

  const headerActionsNode = renderHeaderActions ? (
    <SlotRender
      render={renderHeaderActions}
      args={{ canWrite, selectedSiteId: selectedSiteId || undefined, openCreate }}
    />
  ) : undefined;

  const noSearch = !ui.searchQuery && !ui.statusFilter && !isArchived;

  return (
    <Box data-testid={adapter.pageTestId}>
      {adapter.chrome !== 'embedded' && (
        <PageHeader
          icon={adapter.pageHeaderIcon}
          breadcrumb={breadcrumb}
          title={tl('title')}
          subtitle={tl('subtitle')}
          actions={headerActionsNode}
        />
      )}

      {!selectedSiteId ? (
        <EmptyState
          icon={adapter.emptyIcon}
          title={t('common.noSiteSelected')}
          description={tl('empty.noSite')}
        />
      ) : isLoading ? (
        <LoadingState label={tl('loading')} />
      ) : error ? (
        <Alert severity="error">{tl('loadError')}</Alert>
      ) : items.length === 0 && noSearch ? (
        renderEmptyState ? (
          <SlotRender render={renderEmptyState} args={{ canWrite, openCreate }} />
        ) : (
          <EmptyState
            icon={adapter.emptyIcon}
            title={tl('empty.title')}
            description={tl('empty.description')}
            action={canWrite ? { label: tl('empty.title'), onClick: openCreate } : undefined}
          />
        )
      ) : (
        <>
          <Tabs value={ui.viewTab} onChange={handleTabChange} sx={pageTabsSx}>
            <Tab
              icon={<CheckCircleOutlineIcon fontSize="small" />}
              iconPosition="start"
              label={tl('tabs.active')}
              value="active"
            />
            <Tab
              icon={<ArchiveIcon fontSize="small" />}
              iconPosition="start"
              label={tl('tabs.archived')}
              value="archived"
            />
          </Tabs>

          <BulkActionToolbar
            selectedCount={bulk.count}
            onPublish={isArchived ? undefined : () => dispatch({ type: 'openBulkPublish' })}
            onUnpublish={isArchived ? undefined : () => dispatch({ type: 'openBulkUnpublish' })}
            onArchive={isArchived ? undefined : () => dispatch({ type: 'openBulkArchive' })}
            onRestore={isArchived ? () => dispatch({ type: 'openBulkRestore' }) : undefined}
            onDelete={() => dispatch({ type: 'openBulkDelete' })}
            onClear={bulk.clear}
            canWrite={canWrite}
            isAdmin={isAdmin}
            loading={bulkMutation.isPending}
          />

          <Toolbar>
            <SearchField
              value={ui.searchQuery}
              onChange={(v) => dispatch({ type: 'setSearchQuery', value: v })}
              placeholder={tl('searchPlaceholder')}
              width={320}
              data-testid={adapter.searchTestId}
            />
            {renderToolbarExtras ? (
              <SlotRender
                render={renderToolbarExtras}
                args={{ canWrite, selectedSiteId: selectedSiteId || undefined }}
              />
            ) : null}
            <ToolbarSpacer />
            {!isArchived &&
              chipOptions.map((opt) => (
                <Chip
                  key={opt.value}
                  active={activeChip === opt.value}
                  count={opt.count}
                  onClick={() => handleChipFilterChange(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
          </Toolbar>

          <DataTableV2<TItem>
            data-testid={adapter.tableTestId}
            columns={columns}
            rows={items}
            getKey={(item) => adapter.getItemId(item)}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
            onRowClick={(item) => navigate(adapter.routePath?.(item) ?? `/${adapter.entityKey}s/${adapter.getItemId(item)}`)}
            onSort={handleSort}
            renderActions={(item) => (
              <SlotRender
                render={renderRowActions}
                args={{
                  item,
                  canWrite,
                  isAdmin,
                  rowActions,
                  onView: (i: TItem) => navigate(adapter.routePath?.(i) ?? `/${adapter.entityKey}s/${adapter.getItemId(i)}`),
                  onDelete: openDelete,
                }}
              />
            )}
          />

          <Pagination
            total={total}
            page={page}
            perPage={pageSize}
            onPage={setPage}
            onPerPage={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </>
      )}

      {renderCreateForm ? (
        <SlotRender render={renderCreateForm} args={{ formOpen, closeForm }} />
      ) : null}

      <SlotRender
        render={renderDialogs}
        args={{
          rowState,
          rowActions,
          bulkState,
          bulkActions,
          bulkCount: bulk.count,
          bulkLoading: bulkMutation.isPending,
          onRowConfirmStatus,
          onRowConfirmDelete,
          onBulkConfirm,
          deletingItem,
          onDeleteCancel: closeDelete,
          deleteLoading: deleteMutation.isPending,
        }}
      />
    </Box>
  );
}
