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
import BoltIcon from '@mui/icons-material/Bolt';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { BlogListItem, UpdateBlogRequest, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import TableFilterBar from '@/components/shared/TableFilterBar';
import BlogActionsMenu from '@/components/blogs/BlogActionsMenu';
import CreateBlogWizard from '@/components/blogs/CreateBlogWizard';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type SortDir = 'asc' | 'desc';

export default function BlogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, showSuccess, enqueueSnackbar } = useErrorSnackbar();

  const {
    page, setPage, perPage, formOpen, deleting: deletingBlog,
    openCreate, closeForm,
    openDelete: setDeletingBlog, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<BlogListItem>();

  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [publishingBlog, setPublishingBlog] = useState<BlogListItem | null>(null);
  const [unpublishingBlog, setUnpublishingBlog] = useState<BlogListItem | null>(null);
  const [archivingBlog, setArchivingBlog] = useState<BlogListItem | null>(null);
  const [restoringBlog, setRestoringBlog] = useState<BlogListItem | null>(null);
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [bulkUnpublishOpen, setBulkUnpublishOpen] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('published_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
      const detail = (e as CustomEvent).detail;
      if (detail === 'create-blog') openCreate();
      if (detail === 'quick-post') setQuickPostOpen(true);
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const isArchived = viewTab === 'archived';

  const { data: blogData, isLoading, error } = useQuery({
    queryKey: ['blogs', selectedSiteId, page, perPage, debouncedSearch, statusFilter, sortBy, sortDir, viewTab],
    queryFn: () => apiService.getBlogs(selectedSiteId, {
      page,
      per_page: perPage,
      search: debouncedSearch || undefined,
      status: isArchived ? 'Archived' : (statusFilter || undefined),
      sort_by: sortBy,
      sort_dir: sortDir,
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
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'published_date' ? 'desc' : 'asc');
    }
    setPage(1);
  }, [sortBy, setPage]);

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

  const bulkMutation = useMutation({
    mutationFn: (data: BulkContentRequest) => apiService.bulkBlogs(selectedSiteId, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
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

  const columns: DataTableColumn<BlogListItem>[] = [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(blogIds)}
          checked={bulk.allSelected(blogIds)}
          onChange={() => bulk.selectAll(blogIds)}
          aria-label={t('blogs.table.selectAll')}
        />
      ),
      padding: 'checkbox',
      render: (blog) => (
        <Checkbox
          checked={bulk.isSelected(blog.id)}
          onChange={() => bulk.toggle(blog.id)}
          aria-label={t('blogs.table.selectRow', { slug: blog.slug })}
        />
      ),
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'slug'} direction={sortBy === 'slug' ? sortDir : 'asc'} onClick={() => handleSort('slug')}>
          {t('blogs.table.slug')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => <Typography variant="body2" fontFamily="monospace">{blog.slug || '\u2014'}</Typography>,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'author'} direction={sortBy === 'author' ? sortDir : 'asc'} onClick={() => handleSort('author')}>
          {t('blogs.table.author')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => blog.author,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
          {t('blogs.table.status')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => <StatusChip value={blog.status} />,
    },
    {
      header: t('blogs.table.featured'),
      scope: 'col',
      render: (blog) => blog.is_featured ? <Chip label={t('common.labels.featured')} size="small" color="primary" variant="outlined" /> : null,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'published_date'} direction={sortBy === 'published_date' ? sortDir : 'desc'} onClick={() => handleSort('published_date')}>
          {t('blogs.table.published')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => format(new Date(blog.published_date), 'PP'),
    },
    {
      header: t('blogs.table.actions'),
      scope: 'col',
      align: 'right',
      render: (blog) => (
        <BlogActionsMenu
          blog={blog}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onView={(b) => navigate(`/blogs/${b.id}`)}
          onPublish={(b) => setPublishingBlog(b)}
          onUnpublish={(b) => setUnpublishingBlog(b)}
          onClone={(b) => cloneMutation.mutate(b.id)}
          onDelete={(b) => setDeletingBlog(b)}
          onArchive={(b) => setArchivingBlog(b)}
          onRestore={(b) => setRestoringBlog(b)}
          cloneDisabled={cloneMutation.isPending}
        />
      ),
    },
  ];

  return (
    <Box data-testid="blogs.page">
      <PageHeader
        title={t('blogs.title')}
        subtitle={t('blogs.subtitle')}
        action={selectedSiteId ? { label: t('blogs.createButton'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
        secondaryActions={selectedSiteId ? [
          { label: t('quickPost.title'), icon: <BoltIcon />, onClick: () => setQuickPostOpen(true), hidden: !canWrite },
          { label: t('templates.manageTemplates'), icon: <ViewQuiltIcon />, onClick: () => navigate('/blogs/templates'), hidden: !isAdmin },
        ] : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('blogs.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('blogs.loading')} />
      ) : error ? (
        <Alert severity="error">{t('blogs.loadError')}</Alert>
      ) : blogs.length === 0 && !searchQuery && !statusFilter && !isArchived ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('blogs.empty.title')} description={t('blogs.empty.description')} action={{ label: t('blogs.createButton'), onClick: openCreate }} />
      ) : (
        <>
          <Tabs value={viewTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab icon={<CheckCircleOutlineIcon fontSize="small" />} iconPosition="start" label={t('blogs.tabs.active')} value="active" />
            <Tab icon={<ArchiveIcon fontSize="small" />} iconPosition="start" label={t('blogs.tabs.archived')} value="archived" />
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
              searchPlaceholder={t('blogs.searchPlaceholder')}
              filters={isArchived ? [] : [
                {
                  key: 'status',
                  label: t('common.filters.status'),
                  options: statusFilterOptions,
                  value: statusFilter,
                  onChange: handleStatusFilterChange,
                },
              ]}
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

      <QuickPostDialog open={quickPostOpen} onClose={() => setQuickPostOpen(false)} />
      <CreateBlogWizard open={formOpen} onClose={closeForm} onCreated={(id) => navigate(`/blogs/${id}`)} siteLocales={siteLocales} siteTemplates={siteTemplatesData?.data} siteTemplatesLoading={siteTemplatesLoading} />
      <ConfirmDialog open={!!deletingBlog} title={t('blogs.deleteDialog.title')} message={t('blogs.deleteDialog.message', { slug: deletingBlog?.slug })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingBlog && deleteMutation.mutate(deletingBlog.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={!!publishingBlog} title={t('blogs.publishDialog.title')} message={t('blogs.publishDialog.message', { slug: publishingBlog?.slug })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={() => { if (publishingBlog) { updateMutation.mutate({ id: publishingBlog.id, data: { status: 'Published' } }); setPublishingBlog(null); } }} onCancel={() => setPublishingBlog(null)} />
      <ConfirmDialog open={!!unpublishingBlog} title={t('blogs.unpublishDialog.title')} message={t('blogs.unpublishDialog.message', { slug: unpublishingBlog?.slug })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={() => { if (unpublishingBlog) { updateMutation.mutate({ id: unpublishingBlog.id, data: { status: 'Draft' } }); setUnpublishingBlog(null); } }} onCancel={() => setUnpublishingBlog(null)} />
      <ConfirmDialog open={!!archivingBlog} title={t('blogs.archiveDialog.title')} message={t('blogs.archiveDialog.message', { slug: archivingBlog?.slug })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={() => { if (archivingBlog) { updateMutation.mutate({ id: archivingBlog.id, data: { status: 'Archived' } }); setArchivingBlog(null); } }} onCancel={() => setArchivingBlog(null)} />
      <RestoreDialog open={!!restoringBlog} title={t('blogs.restoreDialog.title')} message={t('blogs.restoreDialog.message', { slug: restoringBlog?.slug })} onRestore={() => { if (restoringBlog) { updateMutation.mutate({ id: restoringBlog.id, data: { status: 'Published' } }); setRestoringBlog(null); } }} onRestoreAsDraft={() => { if (restoringBlog) { updateMutation.mutate({ id: restoringBlog.id, data: { status: 'Draft' } }); setRestoringBlog(null); } }} onCancel={() => setRestoringBlog(null)} />
      <ConfirmDialog open={bulkPublishOpen} title={t('bulk.publishDialog.title')} message={t('bulk.publishDialog.message', { count: bulk.count })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={confirmBulkPublish} onCancel={() => setBulkPublishOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkUnpublishOpen} title={t('bulk.unpublishDialog.title')} message={t('bulk.unpublishDialog.message', { count: bulk.count })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={confirmBulkUnpublish} onCancel={() => setBulkUnpublishOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkArchiveOpen} title={t('bulk.archiveDialog.title')} message={t('bulk.archiveDialog.message', { count: bulk.count })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={confirmBulkArchive} onCancel={() => setBulkArchiveOpen(false)} loading={bulkMutation.isPending} />
      <ConfirmDialog open={bulkRestoreOpen} title={t('bulk.restoreDialog.title')} message={t('bulk.restoreDialog.message', { count: bulk.count })} confirmLabel={t('bulk.restore')} confirmColor="primary" onConfirm={confirmBulkRestore} onCancel={() => setBulkRestoreOpen(false)} loading={bulkMutation.isPending} />
    </Box>
  );
}
