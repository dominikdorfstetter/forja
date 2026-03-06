import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Checkbox,
  Paper,
  Typography,
  Chip,
  TableSortLabel,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { PageListItem, CreatePageRequest, UpdatePageRequest, BulkContentRequest, PageResponse } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import PageTypeChip from '@/components/shared/PageTypeChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import TableFilterBar from '@/components/shared/TableFilterBar';
import PageActionsMenu from '@/components/pages/PageActionsMenu';
import CreatePageWizard from '@/components/pages/CreatePageWizard';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type SortDir = 'asc' | 'desc';

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, enqueueSnackbar } = useErrorSnackbar();

  const {
    page, setPage, perPage, formOpen, deleting: deletingPage,
    openCreate, closeForm,
    openDelete: setDeletingPage, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<PageListItem>();

  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [publishingPage, setPublishingPage] = useState<PageListItem | null>(null);
  const [unpublishingPage, setUnpublishingPage] = useState<PageListItem | null>(null);
  const [archivingPage, setArchivingPage] = useState<PageListItem | null>(null);
  const [restoringPage, setRestoringPage] = useState<PageListItem | null>(null);
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [bulkUnpublishOpen, setBulkUnpublishOpen] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('route');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const debouncedSearch = useDebouncedValue(searchQuery);

  // Reset to page 1 when debounced search changes (not on mount)
  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch, setPage]);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, [setPage]);

  const handleTypeFilterChange = useCallback((value: string) => {
    setTypeFilter(value);
    setPage(1);
  }, [setPage]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'active' | 'archived') => {
    setViewTab(newValue);
    setPage(1);
    setStatusFilter('');
    setSearchQuery('');
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

  const isArchived = viewTab === 'archived';

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['pages', selectedSiteId, page, perPage, debouncedSearch, statusFilter, typeFilter, sortBy, sortDir, viewTab],
    queryFn: () => apiService.getPages(selectedSiteId, {
      page,
      per_page: perPage,
      search: debouncedSearch || undefined,
      status: isArchived ? 'Archived' : (statusFilter || undefined),
      page_type: typeFilter || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      exclude_status: isArchived ? undefined : 'Archived',
    }),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const pages = pageData?.data ?? [];
  const pageIds = pages.map((p) => p.id);

  const bulk = useBulkSelection([page, perPage, pageData]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortBy, setPage]);

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
      setBulkDeleteOpen(false);
      setBulkPublishOpen(false);
      setBulkUnpublishOpen(false);
      setBulkArchiveOpen(false);
      setBulkRestoreOpen(false);
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), { variant: 'warning' });
      }
    },
    onError: showError,
  });

  const handleBulkPublish = () => setBulkPublishOpen(true);
  const handleBulkUnpublish = () => setBulkUnpublishOpen(true);
  const handleBulkArchive = () => setBulkArchiveOpen(true);
  const handleBulkRestore = () => setBulkRestoreOpen(true);
  const confirmBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const confirmBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const confirmBulkArchive = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Archived' });
  const confirmBulkRestore = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const handleBulkDelete = () => setBulkDeleteOpen(true);
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  const statusFilterOptions = [
    { value: '', label: t('common.filters.all') },
    { value: 'Draft', label: t('common.status.draft') },
    { value: 'InReview', label: t('common.status.inReview') },
    { value: 'Scheduled', label: t('common.status.scheduled') },
    { value: 'Published', label: t('common.status.published') },
  ];

  const typeFilterOptions = [
    { value: '', label: t('common.filters.all') },
    { value: 'Static', label: t('pages.wizard.types.static') },
    { value: 'Landing', label: t('pages.wizard.types.landing') },
    { value: 'Contact', label: t('pages.wizard.types.contact') },
    { value: 'BlogIndex', label: t('pages.wizard.types.blogIndex') },
    { value: 'Custom', label: t('pages.wizard.types.custom') },
  ];

  const filters = [];
  if (!isArchived) {
    filters.push({
      key: 'status',
      label: t('common.filters.status'),
      options: statusFilterOptions,
      value: statusFilter,
      onChange: handleStatusFilterChange,
    });
  }
  filters.push({
    key: 'type',
    label: t('common.filters.filterByType'),
    options: typeFilterOptions,
    value: typeFilter,
    onChange: handleTypeFilterChange,
  });

  const columns: DataTableColumn<PageListItem>[] = [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(pageIds)}
          checked={bulk.allSelected(pageIds)}
          onChange={() => bulk.selectAll(pageIds)}
          aria-label={t('pages.table.selectAll')}
        />
      ),
      padding: 'checkbox',
      render: (pg) => (
        <Checkbox
          checked={bulk.isSelected(pg.id)}
          onChange={() => bulk.toggle(pg.id)}
          aria-label={t('pages.table.selectRow', { route: pg.route })}
        />
      ),
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'route'} direction={sortBy === 'route' ? sortDir : 'asc'} onClick={() => handleSort('route')}>
          {t('pages.table.route')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <Typography variant="body2" fontFamily="monospace">{pg.route}</Typography>,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'page_type'} direction={sortBy === 'page_type' ? sortDir : 'asc'} onClick={() => handleSort('page_type')}>
          {t('pages.table.type')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <PageTypeChip value={pg.page_type} />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
          {t('pages.table.status')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <StatusChip value={pg.status} />,
    },
    {
      header: t('pages.table.inNav'),
      scope: 'col',
      render: (pg) => pg.is_in_navigation
        ? <Chip label={t('common.labels.yes')} size="small" color="primary" variant="outlined" />
        : <Chip label={t('common.labels.no')} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => handleSort('created_at')}>
          {t('pages.table.created')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => format(new Date(pg.created_at), 'PP'),
    },
    {
      header: t('pages.table.actions'),
      scope: 'col',
      align: 'right',
      render: (pg) => (
        <PageActionsMenu
          page={pg}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onView={(p) => navigate(`/pages/${p.id}`)}
          onPublish={(p) => setPublishingPage(p)}
          onUnpublish={(p) => setUnpublishingPage(p)}
          onClone={(p) => cloneMutation.mutate(p.id)}
          onDelete={(p) => setDeletingPage(p)}
          onArchive={(p) => setArchivingPage(p)}
          onRestore={(p) => setRestoringPage(p)}
          cloneDisabled={cloneMutation.isPending}
        />
      ),
    },
  ];

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
      ) : pages.length === 0 && !searchQuery && !statusFilter && !typeFilter && !isArchived ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('pages.empty.title')} description={t('pages.empty.description')} action={{ label: t('pages.createButton'), onClick: openCreate }} />
      ) : (
        <>
          <Tabs value={viewTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab icon={<CheckCircleOutlineIcon fontSize="small" />} iconPosition="start" label={t('pages.tabs.active')} value="active" />
            <Tab icon={<ArchiveIcon fontSize="small" />} iconPosition="start" label={t('pages.tabs.archived')} value="archived" />
          </Tabs>
          <BulkActionToolbar
            selectedCount={bulk.count}
            onPublish={isArchived ? undefined : handleBulkPublish}
            onUnpublish={isArchived ? undefined : handleBulkUnpublish}
            onArchive={isArchived ? undefined : handleBulkArchive}
            onRestore={isArchived ? handleBulkRestore : undefined}
            onDelete={handleBulkDelete}
            onClear={bulk.clear}
            canWrite={canWrite}
            isAdmin={isAdmin}
            loading={bulkMutation.isPending}
          />
          <Paper>
            <TableFilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
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
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              isRowSelected={(pg) => bulk.isSelected(pg.id)}
              size="medium"
            />
          </Paper>
        </>
      )}

      <CreatePageWizard open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <ConfirmDialog open={!!deletingPage} title={t('pages.deleteDialog.title')} message={t('pages.deleteDialog.message', { route: deletingPage?.route })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingPage && deleteMutation.mutate(deletingPage.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={!!publishingPage} title={t('pages.publishDialog.title')} message={t('pages.publishDialog.message', { route: publishingPage?.route })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={() => { if (publishingPage) { updateMutation.mutate({ id: publishingPage.id, data: { status: 'Published' } }); setPublishingPage(null); } }} onCancel={() => setPublishingPage(null)} />
      <ConfirmDialog open={!!unpublishingPage} title={t('pages.unpublishDialog.title')} message={t('pages.unpublishDialog.message', { route: unpublishingPage?.route })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={() => { if (unpublishingPage) { updateMutation.mutate({ id: unpublishingPage.id, data: { status: 'Draft' } }); setUnpublishingPage(null); } }} onCancel={() => setUnpublishingPage(null)} />
      <ConfirmDialog open={!!archivingPage} title={t('pages.archiveDialog.title')} message={t('pages.archiveDialog.message', { route: archivingPage?.route })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={() => { if (archivingPage) { updateMutation.mutate({ id: archivingPage.id, data: { status: 'Archived' } }); setArchivingPage(null); } }} onCancel={() => setArchivingPage(null)} />
      <RestoreDialog open={!!restoringPage} title={t('pages.restoreDialog.title')} message={t('pages.restoreDialog.message', { route: restoringPage?.route })} onRestore={() => { if (restoringPage) { updateMutation.mutate({ id: restoringPage.id, data: { status: 'Published' } }); setRestoringPage(null); } }} onRestoreAsDraft={() => { if (restoringPage) { updateMutation.mutate({ id: restoringPage.id, data: { status: 'Draft' } }); setRestoringPage(null); } }} onCancel={() => setRestoringPage(null)} />
      <ConfirmDialog open={bulkPublishOpen} title={t('bulk.publishDialog.title')} message={t('bulk.publishDialog.message', { count: bulk.count })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={confirmBulkPublish} onCancel={() => setBulkPublishOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkUnpublishOpen} title={t('bulk.unpublishDialog.title')} message={t('bulk.unpublishDialog.message', { count: bulk.count })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={confirmBulkUnpublish} onCancel={() => setBulkUnpublishOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkArchiveOpen} title={t('bulk.archiveDialog.title')} message={t('bulk.archiveDialog.message', { count: bulk.count })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={confirmBulkArchive} onCancel={() => setBulkArchiveOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkRestoreOpen} title={t('bulk.restoreDialog.title')} message={t('bulk.restoreDialog.message', { count: bulk.count })} confirmLabel={t('bulk.restore')} confirmColor="primary" onConfirm={confirmBulkRestore} onCancel={() => setBulkRestoreOpen(false)} loading={bulkMutation.isPending} />
    </Box>
  );
}
