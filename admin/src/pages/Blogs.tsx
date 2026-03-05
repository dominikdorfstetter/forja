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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { BlogListItem, ContentTemplate, CreateBlogRequest, UpdateBlogRequest, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import TableFilterBar from '@/components/shared/TableFilterBar';
import BlogFormDialog from '@/components/blogs/BlogFormDialog';
import BlogActionsMenu from '@/components/blogs/BlogActionsMenu';
import TemplateSelectionDialog from '@/components/blogs/TemplateSelectionDialog';
import MarkdownImportDialog from '@/components/blogs/MarkdownImportDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { BlogTemplate } from '@/data/blogTemplates';
import type { MarkdownParseResult } from '@/utils/markdownImport';

type SortDir = 'asc' | 'desc';

export default function BlogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin, userFullName } = useAuth();
  const { showError, showSuccess, enqueueSnackbar } = useErrorSnackbar();

  const {
    page, setPage, perPage, formOpen, editing: editingBlog, deleting: deletingBlog,
    openCreate, closeForm, openEdit: setEditingBlog, closeEdit,
    openDelete: setDeletingBlog, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<BlogListItem>();

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-blog') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data: blogData, isLoading, error } = useQuery({
    queryKey: ['blogs', selectedSiteId, page, perPage, debouncedSearch, statusFilter, sortBy, sortDir],
    queryFn: () => apiService.getBlogs(selectedSiteId, {
      page,
      per_page: perPage,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
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

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<CreateBlogRequest, UpdateBlogRequest>({
    queryKey: 'blogs',
    create: {
      mutationFn: (data) => apiService.createBlog(data),
      successMessage: t('blogs.messages.created'),
      onSuccess: (blog) => { closeForm(); navigate(`/blogs/${blog.id}`); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateBlog(id, data),
      successMessage: t('blogs.messages.updated'),
      onSuccess: () => { closeEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deleteBlog(id),
      successMessage: t('blogs.messages.deleted'),
      onSuccess: () => { closeDelete(); },
    },
  });

  const templateCreateMutation = useMutation({
    mutationFn: async ({ template, source }: { template: BlogTemplate | ContentTemplate; source: 'builtin' | 'custom' }) => {
      let slug: string;
      let is_featured: boolean;
      let allow_comments: boolean;
      let content: { title: string; subtitle: string; excerpt: string; body: string; meta_title: string; meta_description: string };

      if (source === 'builtin') {
        const bt = template as BlogTemplate;
        slug = `${bt.defaults.slug}-${Date.now()}`;
        is_featured = bt.defaults.is_featured;
        allow_comments = bt.defaults.allow_comments;
        content = bt.content;
      } else {
        const ct = template as ContentTemplate;
        slug = `${ct.slug_prefix}-${Date.now()}`;
        is_featured = ct.is_featured;
        allow_comments = ct.allow_comments;
        content = {
          title: ct.title,
          subtitle: ct.subtitle,
          excerpt: ct.excerpt,
          body: ct.body,
          meta_title: ct.meta_title,
          meta_description: ct.meta_description,
        };
      }

      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured,
        allow_comments,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: content.title,
          subtitle: content.subtitle,
          excerpt: content.excerpt,
          body: content.body,
          meta_title: content.meta_title,
          meta_description: content.meta_description,
        });
      }
      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      setTemplateDialogOpen(false);
      showSuccess(t('blogs.messages.created'));
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
  });

  const importCreateMutation = useMutation({
    mutationFn: async (parsed: MarkdownParseResult) => {
      const blog = await apiService.createBlog({
        slug: parsed.slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: parsed.title,
          excerpt: parsed.excerpt,
          body: parsed.body,
          meta_title: parsed.meta_title,
        });
      }
      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      setImportDialogOpen(false);
      showSuccess(t('blogs.messages.created'));
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
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
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), { variant: 'warning' });
      }
    },
    onError: showError,
  });

  const handleBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const handleBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const handleBulkDelete = () => setBulkDeleteOpen(true);
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  const statusFilterOptions = [
    { value: '', label: t('common.filters.all') },
    { value: 'Draft', label: t('common.status.draft') },
    { value: 'InReview', label: t('common.status.inReview') },
    { value: 'Scheduled', label: t('common.status.scheduled') },
    { value: 'Published', label: t('common.status.published') },
    { value: 'Archived', label: t('common.status.archived') },
  ];

  const columns: DataTableColumn<BlogListItem>[] = [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(blogIds)}
          checked={bulk.allSelected(blogIds)}
          onChange={() => bulk.selectAll(blogIds)}
        />
      ),
      padding: 'checkbox',
      render: (blog) => (
        <Checkbox
          checked={bulk.isSelected(blog.id)}
          onChange={() => bulk.toggle(blog.id)}
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
          onEdit={(b) => setEditingBlog(b)}
          onPublish={(b) => updateMutation.mutate({ id: b.id, data: { status: 'Published' } })}
          onUnpublish={(b) => updateMutation.mutate({ id: b.id, data: { status: 'Draft' } })}
          onClone={(b) => cloneMutation.mutate(b.id)}
          onDelete={(b) => setDeletingBlog(b)}
          cloneDisabled={cloneMutation.isPending}
        />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('blogs.title')}
        subtitle={t('blogs.subtitle')}
        action={selectedSiteId ? { label: t('blogs.createButton'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
        secondaryActions={selectedSiteId ? [
          { label: t('templates.fromTemplate'), icon: <DescriptionIcon />, onClick: () => setTemplateDialogOpen(true), hidden: !canWrite },
          { label: t('markdownImport.importButton'), icon: <UploadFileIcon />, onClick: () => setImportDialogOpen(true), hidden: !canWrite },
        ] : undefined}
        secondaryActionsLabel={t('blogs.moreActions')}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('blogs.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('blogs.loading')} />
      ) : error ? (
        <Alert severity="error">{t('blogs.loadError')}</Alert>
      ) : blogs.length === 0 && !searchQuery && !statusFilter ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('blogs.empty.title')} description={t('blogs.empty.description')} action={{ label: t('blogs.createButton'), onClick: openCreate }} />
      ) : (
        <>
          <BulkActionToolbar
            selectedCount={bulk.count}
            onPublish={handleBulkPublish}
            onUnpublish={handleBulkUnpublish}
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
              filters={[
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

      <BlogFormDialog open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <BlogFormDialog open={!!editingBlog} blog={editingBlog} onSubmit={(data) => editingBlog && updateMutation.mutate({ id: editingBlog.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingBlog} title={t('blogs.deleteDialog.title')} message={t('blogs.deleteDialog.message', { slug: deletingBlog?.slug })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingBlog && deleteMutation.mutate(deletingBlog.id)} onCancel={closeDelete} loading={deleteMutation.isPending} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} />
      <TemplateSelectionDialog open={templateDialogOpen} onSelect={(template, source) => templateCreateMutation.mutate({ template, source })} onClose={() => setTemplateDialogOpen(false)} loading={templateCreateMutation.isPending} siteTemplates={siteTemplatesData?.data} siteTemplatesLoading={siteTemplatesLoading} />
      <MarkdownImportDialog open={importDialogOpen} onImport={(parsed) => importCreateMutation.mutate(parsed)} onClose={() => setImportDialogOpen(false)} loading={importCreateMutation.isPending} />
    </Box>
  );
}
