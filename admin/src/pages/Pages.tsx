import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import apiService from '@/services/api';
import type { PageListItem, CreatePageRequest, UpdatePageRequest, BulkContentRequest, PageResponse } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import PagesDialogs from '@/pages/PagesDialogs';
import TableFilterBar from '@/components/shared/TableFilterBar';
import CreatePageWizard from '@/components/pages/CreatePageWizard';
import DataTable from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { uiReducer, initialUIState } from '@/pages/PagesReducer';
import { buildPagesColumns, buildPagesFilters } from '@/pages/PagesTableConfig';

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, enqueueSnackbar } = useErrorSnackbar();
  const { context } = useSiteContextData();
  const workflowEnabled = context.features.editorial_workflow;

  const {
    page, setPage, pageSize, formOpen, deleting: deletingPage,
    openCreate, closeForm,
    openDelete: setDeletingPage, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<PageListItem>();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  const debouncedSearch = useDebouncedValue(ui.searchQuery);

  // Reset to page 1 when debounced search changes (not on mount)
  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch, setPage]);

  const handleStatusFilterChange = useCallback((value: string) => {
    dispatch({ type: 'setStatusFilter', value });
    setPage(1);
  }, [setPage]);

  const handleTypeFilterChange = useCallback((value: string) => {
    dispatch({ type: 'setTypeFilter', value });
    setPage(1);
  }, [setPage]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'active' | 'archived') => {
    dispatch({ type: 'setViewTab', value: newValue });
    setPage(1);
    bulk.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPage]);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-page') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const isArchived = ui.viewTab === 'archived';

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['pages', selectedSiteId, page, pageSize, debouncedSearch, ui.statusFilter, ui.typeFilter, ui.sortBy, ui.sortDir, ui.viewTab],
    queryFn: () => apiService.getPages(selectedSiteId, {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status: isArchived ? 'Archived' : (ui.statusFilter || undefined),
      page_type: ui.typeFilter || undefined,
      sort_by: ui.sortBy,
      sort_dir: ui.sortDir,
      exclude_status: isArchived ? undefined : 'Archived',
    }),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const pages = pageData?.data ?? [];
  const pageIds = pages.map((p) => p.id);

  const bulk = useBulkSelection([page, pageSize, pageData]);

  const handleSort = useCallback((column: string) => {
    if (ui.sortBy === column) {
      dispatch({ type: 'setSort', sortBy: column, sortDir: ui.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      dispatch({ type: 'setSort', sortBy: column, sortDir: 'asc' });
    }
    setPage(1);
  }, [ui.sortBy, ui.sortDir, setPage]);

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<CreatePageRequest, UpdatePageRequest>({
    queryKey: 'pages',
    create: {
      mutationFn: (data) => apiService.createPage(data),
      successMessage: t('pages.messages.created'),
      onSuccess: (result: PageResponse) => {
        closeForm();
        navigate(`/pages/${result.id}`);
      },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updatePage(id, data),
      successMessage: t('pages.messages.updated'),
    },
    delete: {
      mutationFn: (id) => apiService.deletePage(id),
      successMessage: t('pages.messages.deleted'),
      onSuccess: () => { closeDelete(); },
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiService.clonePage(id),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      enqueueSnackbar(t('pages.messages.cloned'), { variant: 'success' });
      navigate(`/pages/${page.id}`);
    },
    onError: showError,
  });

  const bulkMutation = useMutation({
    mutationFn: (data: BulkContentRequest) => apiService.bulkPages(selectedSiteId, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      bulk.clear();
      dispatch({ type: 'closeAllBulk' });
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), { variant: 'warning' });
      }
    },
    onError: showError,
  });

  const confirmBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const confirmBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const confirmBulkArchive = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Archived' });
  const confirmBulkRestore = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  const filters = buildPagesFilters({
    t,
    workflowEnabled,
    isArchived,
    statusFilter: ui.statusFilter,
    typeFilter: ui.typeFilter,
    onStatusFilterChange: handleStatusFilterChange,
    onTypeFilterChange: handleTypeFilterChange,
  });

  const columns = buildPagesColumns({
    t,
    bulk,
    pageIds,
    sortBy: ui.sortBy,
    sortDir: ui.sortDir,
    canWrite,
    isAdmin,
    handleSort,
    onView: (p) => navigate(`/pages/${p.id}`),
    onPublish: (p) => dispatch({ type: 'openPublish', page: p }),
    onUnpublish: (p) => dispatch({ type: 'openUnpublish', page: p }),
    onClone: (p) => cloneMutation.mutate(p.id),
    onDelete: (p) => setDeletingPage(p),
    onArchive: (p) => dispatch({ type: 'openArchive', page: p }),
    onRestore: (p) => dispatch({ type: 'openRestore', page: p }),
    cloneDisabled: cloneMutation.isPending,
  });

  return (
    <Box data-testid="pages.page">
      <PageHeader
        title={t('pages.title')}
        subtitle={t('pages.subtitle')}
        action={selectedSiteId ? { label: t('pages.createButton'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('pages.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('pages.loading')} />
      ) : error ? (
        <Alert severity="error">{t('pages.loadError')}</Alert>
      ) : pages.length === 0 && !ui.searchQuery && !ui.statusFilter && !ui.typeFilter && !isArchived ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('pages.empty.title')} description={t('pages.empty.description')} action={{ label: t('pages.createButton'), onClick: openCreate }} />
      ) : (
        <>
          <Tabs value={ui.viewTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab icon={<CheckCircleOutlineIcon fontSize="small" />} iconPosition="start" label={t('pages.tabs.active')} value="active" />
            <Tab icon={<ArchiveIcon fontSize="small" />} iconPosition="start" label={t('pages.tabs.archived')} value="archived" />
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
          <Paper>
            <TableFilterBar
              searchValue={ui.searchQuery}
              onSearchChange={(v) => dispatch({ type: 'setSearchQuery', value: v })}
              searchPlaceholder={t('pages.searchPlaceholder')}
              filters={filters}
            />
            <DataTable<PageListItem>
              data={pages}
              columns={columns}
              getRowKey={(pg) => pg.id}
              meta={pageData?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleRowsPerPageChange}
              isRowSelected={(pg) => bulk.isSelected(pg.id)}
              size="medium"
            />
          </Paper>
        </>
      )}

      <CreatePageWizard open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <PagesDialogs
        publishingPage={ui.publishingPage}
        onPublishConfirm={() => { if (ui.publishingPage) { updateMutation.mutate({ id: ui.publishingPage.id, data: { status: 'Published' } }); dispatch({ type: 'closePublish' }); } }}
        onPublishCancel={() => dispatch({ type: 'closePublish' })}
        unpublishingPage={ui.unpublishingPage}
        onUnpublishConfirm={() => { if (ui.unpublishingPage) { updateMutation.mutate({ id: ui.unpublishingPage.id, data: { status: 'Draft' } }); dispatch({ type: 'closeUnpublish' }); } }}
        onUnpublishCancel={() => dispatch({ type: 'closeUnpublish' })}
        archivingPage={ui.archivingPage}
        onArchiveConfirm={() => { if (ui.archivingPage) { updateMutation.mutate({ id: ui.archivingPage.id, data: { status: 'Archived' } }); dispatch({ type: 'closeArchive' }); } }}
        onArchiveCancel={() => dispatch({ type: 'closeArchive' })}
        restoringPage={ui.restoringPage}
        onRestorePublish={() => { if (ui.restoringPage) { updateMutation.mutate({ id: ui.restoringPage.id, data: { status: 'Published' } }); dispatch({ type: 'closeRestore' }); } }}
        onRestoreAsDraft={() => { if (ui.restoringPage) { updateMutation.mutate({ id: ui.restoringPage.id, data: { status: 'Draft' } }); dispatch({ type: 'closeRestore' }); } }}
        onRestoreCancel={() => dispatch({ type: 'closeRestore' })}
        deletingPage={deletingPage}
        onDeleteConfirm={() => deletingPage && deleteMutation.mutate(deletingPage.id)}
        onDeleteCancel={closeDelete}
        deleteLoading={deleteMutation.isPending}
        bulkCount={bulk.count}
        bulkDeleteOpen={ui.bulkDeleteOpen}
        bulkPublishOpen={ui.bulkPublishOpen}
        bulkUnpublishOpen={ui.bulkUnpublishOpen}
        bulkArchiveOpen={ui.bulkArchiveOpen}
        bulkRestoreOpen={ui.bulkRestoreOpen}
        onBulkDeleteConfirm={confirmBulkDelete}
        onBulkPublishConfirm={confirmBulkPublish}
        onBulkUnpublishConfirm={confirmBulkUnpublish}
        onBulkArchiveConfirm={confirmBulkArchive}
        onBulkRestoreConfirm={confirmBulkRestore}
        onBulkCancel={() => dispatch({ type: 'closeAllBulk' })}
        bulkLoading={bulkMutation.isPending}
      />
    </Box>
  );
}
