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
import BoltIcon from '@mui/icons-material/Bolt';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import apiService from '@/services/api';
import type { BlogListItem, UpdateBlogRequest, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import BlogsDialogs from '@/pages/BlogsDialogs';
import TableFilterBar from '@/components/shared/TableFilterBar';
import CreateBlogWizard from '@/components/blogs/CreateBlogWizard';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import DataTable from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { uiReducer, initialUIState } from '@/pages/BlogsReducer';
import { buildBlogsColumns, buildBlogsFilters } from '@/pages/BlogsTableConfig';

export default function BlogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, showSuccess, enqueueSnackbar } = useErrorSnackbar();
  const { context } = useSiteContextData();
  const workflowEnabled = context.features.editorial_workflow;

  const {
    page, setPage, perPage, formOpen, deleting: deletingBlog,
    openCreate, closeForm,
    openDelete: setDeletingBlog, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<BlogListItem>();

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

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'active' | 'archived') => {
    dispatch({ type: 'setViewTab', value: newValue });
    setPage(1);
    bulk.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPage]);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'create-blog') openCreate();
      if (detail === 'quick-post') dispatch({ type: 'openQuickPost' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const isArchived = ui.viewTab === 'archived';

  const { data: blogData, isLoading, error } = useQuery({
    queryKey: ['blogs', selectedSiteId, page, perPage, debouncedSearch, ui.statusFilter, ui.sortBy, ui.sortDir, ui.viewTab],
    queryFn: () => apiService.getBlogs(selectedSiteId, {
      page,
      per_page: perPage,
      search: debouncedSearch || undefined,
      status: isArchived ? 'Archived' : (ui.statusFilter || undefined),
      sort_by: ui.sortBy,
      sort_dir: ui.sortDir,
      exclude_status: isArchived ? undefined : 'Archived',
    }),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const { data: siteLocales } = useQuery({
    queryKey: ['siteLocales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: siteTemplatesData, isLoading: siteTemplatesLoading } = useQuery({
    queryKey: ['content-templates', selectedSiteId],
    queryFn: () => apiService.getContentTemplates(selectedSiteId, { per_page: 100 }),
    enabled: !!selectedSiteId,
  });

  const blogs = blogData?.data ?? [];
  const blogIds = blogs.map((b) => b.id);

  const bulk = useBulkSelection([page, perPage, blogData]);

  const handleSort = useCallback((column: string) => {
    if (ui.sortBy === column) {
      dispatch({ type: 'setSort', sortBy: column, sortDir: ui.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      dispatch({ type: 'setSort', sortBy: column, sortDir: column === 'published_date' ? 'desc' : 'asc' });
    }
    setPage(1);
  }, [ui.sortBy, ui.sortDir, setPage]);

  const { updateMutation, deleteMutation } = useCrudMutations<never, UpdateBlogRequest>({
    queryKey: 'blogs',
    update: {
      mutationFn: ({ id, data }) => apiService.updateBlog(id, data),
      successMessage: t('blogs.messages.updated'),
    },
    delete: {
      mutationFn: (id) => apiService.deleteBlog(id),
      successMessage: t('blogs.messages.deleted'),
      onSuccess: () => { closeDelete(); },
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiService.cloneBlog(id),
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.cloned'));
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
  });

  const seedMutation = useMutation({
    mutationFn: () => apiService.seedSampleContent(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.sampleSeeded'));
    },
    onError: showError,
  });

  const bulkMutation = useMutation({
    mutationFn: (data: BulkContentRequest) => apiService.bulkBlogs(selectedSiteId, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
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

  const filters = buildBlogsFilters({ t, workflowEnabled, isArchived, statusFilter: ui.statusFilter, onStatusFilterChange: handleStatusFilterChange });

  const columns = buildBlogsColumns({
    t,
    bulk,
    blogIds,
    sortBy: ui.sortBy,
    sortDir: ui.sortDir,
    canWrite,
    isAdmin,
    handleSort,
    onView: (b) => navigate(`/blogs/${b.id}`),
    onPublish: (b) => dispatch({ type: 'openPublish', blog: b }),
    onUnpublish: (b) => dispatch({ type: 'openUnpublish', blog: b }),
    onClone: (b) => cloneMutation.mutate(b.id),
    onDelete: (b) => setDeletingBlog(b),
    onArchive: (b) => dispatch({ type: 'openArchive', blog: b }),
    onRestore: (b) => dispatch({ type: 'openRestore', blog: b }),
    cloneDisabled: cloneMutation.isPending,
  });

  return (
    <Box data-testid="blogs.page">
      <PageHeader
        title={t('blogs.title')}
        subtitle={t('blogs.subtitle')}
        action={selectedSiteId ? { label: t('blogs.createButton'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
        secondaryActions={selectedSiteId ? [
          { label: t('quickPost.title'), icon: <BoltIcon />, onClick: () => dispatch({ type: 'openQuickPost' }), hidden: !canWrite },
          { label: t('templates.manageTemplates'), icon: <ViewQuiltIcon />, onClick: () => navigate('/blogs/templates'), hidden: !isAdmin },
        ] : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('blogs.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('blogs.loading')} />
      ) : error ? (
        <Alert severity="error">{t('blogs.loadError')}</Alert>
      ) : blogs.length === 0 && !ui.searchQuery && !ui.statusFilter && !isArchived ? (
        <EmptyState
          icon={<ArticleIcon sx={{ fontSize: 64 }} />}
          title={t('blogs.empty.title')}
          description={t('blogs.empty.description')}
          action={{ label: t('blogs.createButton'), onClick: openCreate }}
          secondaryAction={canWrite ? { label: t('blogs.empty.seedSamples'), onClick: () => seedMutation.mutate() } : undefined}
        />
      ) : (
        <>
          <Tabs value={ui.viewTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab icon={<CheckCircleOutlineIcon fontSize="small" />} iconPosition="start" label={t('blogs.tabs.active')} value="active" />
            <Tab icon={<ArchiveIcon fontSize="small" />} iconPosition="start" label={t('blogs.tabs.archived')} value="archived" />
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
              searchPlaceholder={t('blogs.searchPlaceholder')}
              filters={filters}
            />
            <DataTable<BlogListItem>
              data={blogs}
              columns={columns}
              getRowKey={(blog) => blog.id}
              meta={blogData?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              isRowSelected={(blog) => bulk.isSelected(blog.id)}
              size="medium"
            />
          </Paper>
        </>
      )}

      <QuickPostDialog open={ui.quickPostOpen} onClose={() => dispatch({ type: 'closeQuickPost' })} />
      <CreateBlogWizard open={formOpen} onClose={closeForm} onCreated={(id) => navigate(`/blogs/${id}`)} siteLocales={siteLocales} siteTemplates={siteTemplatesData?.data} siteTemplatesLoading={siteTemplatesLoading} />
      <BlogsDialogs
        publishingBlog={ui.publishingBlog}
        onPublishConfirm={() => { if (ui.publishingBlog) { updateMutation.mutate({ id: ui.publishingBlog.id, data: { status: 'Published' } }); dispatch({ type: 'closePublish' }); } }}
        onPublishCancel={() => dispatch({ type: 'closePublish' })}
        unpublishingBlog={ui.unpublishingBlog}
        onUnpublishConfirm={() => { if (ui.unpublishingBlog) { updateMutation.mutate({ id: ui.unpublishingBlog.id, data: { status: 'Draft' } }); dispatch({ type: 'closeUnpublish' }); } }}
        onUnpublishCancel={() => dispatch({ type: 'closeUnpublish' })}
        archivingBlog={ui.archivingBlog}
        onArchiveConfirm={() => { if (ui.archivingBlog) { updateMutation.mutate({ id: ui.archivingBlog.id, data: { status: 'Archived' } }); dispatch({ type: 'closeArchive' }); } }}
        onArchiveCancel={() => dispatch({ type: 'closeArchive' })}
        restoringBlog={ui.restoringBlog}
        onRestorePublish={() => { if (ui.restoringBlog) { updateMutation.mutate({ id: ui.restoringBlog.id, data: { status: 'Published' } }); dispatch({ type: 'closeRestore' }); } }}
        onRestoreAsDraft={() => { if (ui.restoringBlog) { updateMutation.mutate({ id: ui.restoringBlog.id, data: { status: 'Draft' } }); dispatch({ type: 'closeRestore' }); } }}
        onRestoreCancel={() => dispatch({ type: 'closeRestore' })}
        deletingBlog={deletingBlog}
        onDeleteConfirm={() => deletingBlog && deleteMutation.mutate(deletingBlog.id)}
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
