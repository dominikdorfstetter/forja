import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { BlogListItem, ContentTemplate, CreateBlogRequest, UpdateBlogRequest, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import BlogFormDialog from '@/components/blogs/BlogFormDialog';
import TemplateSelectionDialog from '@/components/blogs/TemplateSelectionDialog';
import MarkdownImportDialog from '@/components/blogs/MarkdownImportDialog';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import type { BlogTemplate } from '@/data/blogTemplates';
import type { MarkdownParseResult } from '@/utils/markdownImport';

export default function BlogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin, userFullName } = useAuth();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogListItem | null>(null);
  const [deletingBlog, setDeletingBlog] = useState<BlogListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { data: blogData, isLoading, error } = useQuery({
    queryKey: ['blogs', selectedSiteId, page, perPage],
    queryFn: () => apiService.getBlogs(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
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

  const blogs = blogData?.data;
  const blogIds = blogs?.map((b) => b.id) ?? [];

  const bulk = useBulkSelection([page, perPage, blogData]);

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
      enqueueSnackbar(t('blogs.messages.created'), { variant: 'success' });
      navigate(`/blogs/${blog.id}`);
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
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
      enqueueSnackbar(t('blogs.messages.created'), { variant: 'success' });
      navigate(`/blogs/${blog.id}`);
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBlogRequest) => apiService.createBlog(data),
    onSuccess: (blog) => { queryClient.invalidateQueries({ queryKey: ['blogs'] }); setFormOpen(false); enqueueSnackbar(t('blogs.messages.created'), { variant: 'success' }); navigate(`/blogs/${blog.id}`); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlogRequest }) => apiService.updateBlog(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blogs'] }); setEditingBlog(null); enqueueSnackbar(t('blogs.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteBlog(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blogs'] }); setDeletingBlog(null); enqueueSnackbar(t('blogs.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiService.cloneBlog(id),
    onSuccess: (blog) => { queryClient.invalidateQueries({ queryKey: ['blogs'] }); enqueueSnackbar(t('blogs.messages.cloned'), { variant: 'success' }); navigate(`/blogs/${blog.id}`); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
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
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const handleBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const handleBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const handleBulkDelete = () => setBulkDeleteOpen(true);
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  return (
    <Box>
      <PageHeader
        title={t('blogs.title')}
        subtitle={t('blogs.subtitle')}
        action={selectedSiteId ? { label: t('blogs.createButton'), icon: <AddIcon />, onClick: () => setFormOpen(true), hidden: !canWrite } : undefined}
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
      ) : !blogs || blogs.length === 0 ? (
        <EmptyState icon={<ArticleIcon sx={{ fontSize: 64 }} />} title={t('blogs.empty.title')} description={t('blogs.empty.description')} action={{ label: t('blogs.createButton'), onClick: () => setFormOpen(true) }} />
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
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={bulk.count > 0 && !bulk.allSelected(blogIds)}
                      checked={bulk.allSelected(blogIds)}
                      onChange={() => bulk.selectAll(blogIds)}
                    />
                  </TableCell>
                  <TableCell scope="col">{t('blogs.table.slug')}</TableCell>
                  <TableCell scope="col">{t('blogs.table.author')}</TableCell>
                  <TableCell scope="col">{t('blogs.table.status')}</TableCell>
                  <TableCell scope="col">{t('blogs.table.featured')}</TableCell>
                  <TableCell scope="col">{t('blogs.table.published')}</TableCell>
                  <TableCell scope="col" align="right">{t('blogs.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {blogs.map((blog) => (
                  <TableRow key={blog.id} selected={bulk.isSelected(blog.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={bulk.isSelected(blog.id)}
                        onChange={() => bulk.toggle(blog.id)}
                      />
                    </TableCell>
                    <TableCell><Typography variant="body2" fontFamily="monospace">{blog.slug || '—'}</Typography></TableCell>
                    <TableCell>{blog.author}</TableCell>
                    <TableCell><StatusChip value={blog.status} /></TableCell>
                    <TableCell>{blog.is_featured && <Chip label={t('common.labels.featured')} size="small" color="primary" variant="outlined" />}</TableCell>
                    <TableCell>{format(new Date(blog.published_date), 'PP')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('blogs.viewDetail')}><IconButton size="small" aria-label={t('blogs.viewDetail')} onClick={() => navigate(`/blogs/${blog.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      {canWrite && <Tooltip title={t('common.actions.clone')}><IconButton size="small" aria-label={t('common.actions.clone')} onClick={() => cloneMutation.mutate(blog.id)} disabled={cloneMutation.isPending}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>}
                      {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingBlog(blog)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingBlog(blog)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {blogData?.meta && (
            <TablePagination
              component="div"
              count={blogData.meta.total_items}
              page={blogData.meta.page - 1}
              onPageChange={(_, p) => setPage(p + 1)}
              rowsPerPage={blogData.meta.page_size}
              onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          )}
        </>
      )}

      <BlogFormDialog open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={() => setFormOpen(false)} loading={createMutation.isPending} />
      <BlogFormDialog open={!!editingBlog} blog={editingBlog} onSubmit={(data) => editingBlog && updateMutation.mutate({ id: editingBlog.id, data })} onClose={() => setEditingBlog(null)} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingBlog} title={t('blogs.deleteDialog.title')} message={t('blogs.deleteDialog.message', { slug: deletingBlog?.slug })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingBlog && deleteMutation.mutate(deletingBlog.id)} onCancel={() => setDeletingBlog(null)} loading={deleteMutation.isPending} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} />
      <TemplateSelectionDialog open={templateDialogOpen} onSelect={(template, source) => templateCreateMutation.mutate({ template, source })} onClose={() => setTemplateDialogOpen(false)} loading={templateCreateMutation.isPending} siteTemplates={siteTemplatesData?.data} siteTemplatesLoading={siteTemplatesLoading} />
      <MarkdownImportDialog open={importDialogOpen} onImport={(parsed) => importCreateMutation.mutate(parsed)} onClose={() => setImportDialogOpen(false)} loading={importCreateMutation.isPending} />
    </Box>
  );
}
