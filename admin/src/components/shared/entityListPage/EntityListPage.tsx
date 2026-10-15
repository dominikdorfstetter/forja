import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tabs, Tab } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useNavigate } from 'react-router';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import { SlotRender } from '@/components/shared/SlotRender';
import { PageHeader, DataTableV2, pageTabsSx, Pagination } from '@/components/shared/listPageV2';
import { useListPageState } from '@/hooks/useListPageState';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { EntityListPageProps, RowDialogState } from './types';
import { buildListQueryParams, bulkToolbarHandlers, entityRoutePath, resolveListView } from './entityListHelpers';
import { useArchivedTabParam, useEntityListUiState } from './useEntityListUiState';
import { useEntityListData } from './useEntityListData';
import { useEntityListMutations } from './useEntityListMutations';
import { EntityListStatusView, EntityListToolbar } from './EntityListSections';

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
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
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

  const { ui, dispatch, debouncedSearch, handleSort, handleChipFilterChange, rowActions, bulkActions } =
    useEntityListUiState<TItem>(adapter.defaultSort, setPage);

  const isArchived = ui.viewTab === 'archived';

  const queryParams = useMemo(
    () =>
      buildListQueryParams({
        page,
        pageSize,
        search: debouncedSearch,
        isArchived,
        statusFilter: ui.statusFilter,
        sortBy: ui.sortBy,
        sortDir: ui.sortDir,
        extra: extraQueryParams,
      }),
    [page, pageSize, debouncedSearch, isArchived, ui.statusFilter, ui.sortBy, ui.sortDir, extraQueryParams],
  );

  const { listData, items, total, isLoading, error, statusCounts } = useEntityListData({
    adapter,
    selectedSiteId,
    queryParams,
    extraQueryDeps,
  });

  const bulk = useBulkSelection([page, pageSize, listData]);

  const handleTabChange = useArchivedTabParam(ui.viewTab, dispatch, () => {
    setPage(1);
    bulk.clear();
  });

  const { onRowConfirmStatus, onRowConfirmDelete, onBulkConfirm, deleteLoading, bulkLoading } =
    useEntityListMutations({
      adapter,
      selectedSiteId,
      tl,
      closeDelete,
      selectedIds: bulk.selectedIds,
      onBulkSettled: () => {
        bulk.clear();
        bulkActions.closeAllBulk();
      },
    });

  const rowState: RowDialogState<TItem> = {
    publishingItem: ui.publishingItem,
    unpublishingItem: ui.unpublishingItem,
    archivingItem: ui.archivingItem,
    restoringItem: ui.restoringItem,
  };

  const bulkState = {
    bulkDeleteOpen: ui.bulkDeleteOpen,
    bulkPublishOpen: ui.bulkPublishOpen,
    bulkUnpublishOpen: ui.bulkUnpublishOpen,
    bulkArchiveOpen: ui.bulkArchiveOpen,
    bulkRestoreOpen: ui.bulkRestoreOpen,
  };

  const chipOptions = adapter.buildChipFilters({ t, workflowEnabled, counts: statusCounts });
  const columns = adapter.buildColumns({ t, fmt, sortBy: ui.sortBy, sortDir: ui.sortDir });

  const selected = new Set(bulk.selectedIds);
  const onToggleSelect = (id: string) => bulk.toggle(id);
  const onToggleAll = (next: boolean) => {
    if (next) bulk.selectAll(items.map((item) => adapter.getItemId(item)));
    else bulk.clear();
  };
  const openItem = (item: TItem) => navigate(entityRoutePath(adapter, item));

  const slotSiteId = selectedSiteId || undefined;
  const view = resolveListView({
    hasSite: !!selectedSiteId,
    isLoading,
    hasError: !!error,
    itemCount: items.length,
    pristine: !ui.searchQuery && !ui.statusFilter && !isArchived,
  });

  return (
    <Box data-testid={adapter.pageTestId}>
      {adapter.chrome !== 'embedded' && (
        <PageHeader
          icon={adapter.pageHeaderIcon}
          breadcrumb={t('layout.sidebar.content') + ' / ' + tl('breadcrumb')}
          title={tl('title')}
          subtitle={tl('subtitle')}
          actions={
            renderHeaderActions && (
              <SlotRender
                render={renderHeaderActions}
                args={{ canWrite, selectedSiteId: slotSiteId, openCreate }}
              />
            )
          }
        />
      )}

      {view !== 'ready' ? (
        <EntityListStatusView
          view={view}
          tl={tl}
          emptyIcon={adapter.emptyIcon}
          canWrite={canWrite}
          openCreate={openCreate}
          renderEmptyState={renderEmptyState}
        />
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
            {...bulkToolbarHandlers(isArchived, bulkActions)}
            onDelete={bulkActions.openBulkDelete}
            onClear={bulk.clear}
            canWrite={canWrite}
            isAdmin={isAdmin}
            loading={bulkLoading}
          />

          <EntityListToolbar
            tl={tl}
            searchQuery={ui.searchQuery}
            onSearchChange={(v) => dispatch({ type: 'setSearchQuery', value: v })}
            searchTestId={adapter.searchTestId}
            extras={
              renderToolbarExtras && {
                render: renderToolbarExtras,
                args: { canWrite, selectedSiteId: slotSiteId },
              }
            }
            chips={
              isArchived
                ? undefined
                : { options: chipOptions, active: ui.statusFilter || 'all', onChange: handleChipFilterChange }
            }
          />

          <DataTableV2<TItem>
            data-testid={adapter.tableTestId}
            columns={columns}
            rows={items}
            getKey={(item) => adapter.getItemId(item)}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
            onRowClick={openItem}
            onSort={handleSort}
            renderActions={(item) => (
              <SlotRender
                render={renderRowActions}
                args={{ item, canWrite, isAdmin, rowActions, onView: openItem, onDelete: openDelete }}
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
          bulkLoading,
          onRowConfirmStatus,
          onRowConfirmDelete,
          onBulkConfirm,
          deletingItem,
          onDeleteCancel: closeDelete,
          deleteLoading,
        }}
      />
    </Box>
  );
}
