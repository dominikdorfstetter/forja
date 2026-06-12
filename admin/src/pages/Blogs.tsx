import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import ArticleIcon from '@mui/icons-material/Article';
import { bulkBlogs, cloneBlog, deleteBlog, getBlogStatusCounts, getBlogs, seedSampleContent, updateBlog } from '@/services/blogs';
import { getContentTemplates } from '@/services/contentTemplates';
import { getSiteLocales } from '@/services/siteLocales';
import type { BlogListItem } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import EmptyState from '@/components/shared/EmptyState';
import CreateBlogWizard from '@/components/blogs/CreateBlogWizard';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import { ContentEntityActionMenu } from '@/components/shared/contentEntityActionMenu';
import { M3Button } from '@/components/design-system';
import EntityListPage, { ContentEntityDialogs } from '@/components/shared/entityListPage';
import type { EntityListAdapter } from '@/components/shared/entityListPage';
import { buildBlogsColumns, buildBlogsChipFilters } from '@/pages/BlogsTableConfig';
import { queryKeys } from '@/lib/queryKeys';

const blogsAdapter: EntityListAdapter<BlogListItem, Awaited<ReturnType<typeof getBlogStatusCounts>>> = {
  entityKey: 'blog',
  pageHeaderIcon: 'article',
  i18nNamespace: 'blogs',
  fetchList: (siteId, params) =>
    getBlogs(siteId, {
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      status: params.status,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      exclude_status: params.exclude_status,
    }),
  listQueryKey: (siteId, params) =>
    queryKeys.blogs(
      siteId,
      params.page,
      params.page_size,
      params.search ?? '',
      params.status ?? '',
      params.sort_by ?? '',
      params.sort_dir ?? '',
      params.exclude_status ?? '',
    ),
  fetchStatusCounts: (siteId) => getBlogStatusCounts(siteId),
  statusCountsQueryKey: (siteId) => queryKeys.blogsStatusCounts(siteId),
  bulkExtraInvalidations: (siteId) => [
    queryKeys.trashCount(siteId),
    queryKeys.trash(siteId),
    queryKeys.blogsStatusCounts(siteId),
  ],
  getItemId: (item) => item.id,
  updateEntity: (id, data) => updateBlog(id, data),
  deleteEntity: (id) => deleteBlog(id),
  bulkAction: (siteId, request) => bulkBlogs(siteId, request),
  defaultSort: { sortBy: 'published_date', sortDir: 'desc' },
  buildColumns: (deps) => buildBlogsColumns(deps),
  buildChipFilters: ({ t, workflowEnabled, counts }) => buildBlogsChipFilters({ t, workflowEnabled, counts }),
  pageTestId: 'blogs.page',
  tableTestId: 'post.table',
  searchTestId: 'blogs-search',
  emptyIcon: <ArticleIcon sx={{ fontSize: 64 }} />,
};

export default function BlogsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();

  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [createTrigger, setCreateTrigger] = useState(0);

  // CreateBlogWizard data — owned here, not the shared component.
  const { data: siteLocales } = useQuery({
    queryKey: queryKeys.siteLocalesOverview(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: siteTemplatesData, isLoading: siteTemplatesLoading } = useQuery({
    queryKey: queryKeys.contentTemplates(selectedSiteId),
    queryFn: () => getContentTemplates(selectedSiteId, { page_size: 100 }),
    enabled: !!selectedSiteId,
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => cloneBlog(id),
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogsStatusCounts(selectedSiteId) });
      showSuccess(t('blogs.messages.cloned'));
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
  });

  const seedMutation = useMutation({
    mutationFn: () => seedSampleContent(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogsStatusCounts(selectedSiteId) });
      showSuccess(t('blogs.messages.sampleSeeded'));
    },
    onError: showError,
  });

  // Command palette listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'create-blog') setCreateTrigger((v) => v + 1);
      if (detail === 'quick-post') setQuickPostOpen(true);
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  return (
    <>
      <EntityListPage
        adapter={blogsAdapter}
        renderHeaderActions={({ canWrite, selectedSiteId: siteId, openCreate }) =>
          siteId && canWrite ? (
            <>
              <M3Button
                variant="outlined"
                size="md"
                icon="view_quilt"
                onClick={() => navigate('/blogs/templates')}
                data-testid="blogs.btn.manage-templates"
              >
                {t('blogs.actions.manageTemplates', 'Manage Templates')}
              </M3Button>
              <M3Button size="md" icon="add" onClick={openCreate} data-testid="create-post">
                {t('blogs.createButton')}
              </M3Button>
            </>
          ) : null
        }
        renderEmptyState={({ canWrite, openCreate }) => (
          <EmptyState
            icon={<ArticleIcon sx={{ fontSize: 64 }} />}
            title={t('blogs.empty.title')}
            description={t('blogs.empty.description')}
            action={{ label: t('blogs.createButton'), onClick: openCreate }}
            secondaryAction={
              canWrite
                ? { label: t('blogs.empty.seedSamples'), onClick: () => seedMutation.mutate() }
                : undefined
            }
          />
        )}
        renderRowActions={({ item, canWrite, isAdmin, rowActions, onView, onDelete }) => (
          <ContentEntityActionMenu
            kind="blog"
            entity={item}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onView={onView}
            onPublish={rowActions.openPublish}
            onUnpublish={rowActions.openUnpublish}
            onClone={(b) => cloneMutation.mutate(b.id)}
            onDelete={onDelete}
            onArchive={rowActions.openArchive}
            onRestore={rowActions.openRestore}
            cloneDisabled={cloneMutation.isPending}
          />
        )}
        renderCreateForm={({ formOpen, closeForm }) => (
          <CreateBlogWizard
            open={formOpen}
            onClose={closeForm}
            onCreated={(id) => navigate(`/blogs/${id}`)}
            siteLocales={siteLocales}
            siteTemplates={siteTemplatesData?.data}
            siteTemplatesLoading={siteTemplatesLoading}
          />
        )}
        renderDialogs={(props) => (
          <ContentEntityDialogs
            {...props}
            descriptor={{ i18nNamespace: 'blogs', identifierField: 'slug', restore: 'publishOrDraft' }}
          />
        )}
      />

      <QuickPostDialog open={quickPostOpen} onClose={() => setQuickPostOpen(false)} />

      {/* Hidden: command-palette `create-blog` action triggers via useEffect → setCreateTrigger.
          The actual Wizard is rendered inside renderCreateForm; we trigger it via openCreate,
          which lives inside EntityListPage. Bridge it via a hidden button. */}
      {createTrigger > 0 && (
        <CommandPaletteCreateBridge key={createTrigger} />
      )}
    </>
  );
}

function CommandPaletteCreateBridge() {
  // The shared component owns formOpen state via useListPageState; opening from the
  // command palette requires reaching into that state. Simplest bridge: dispatch a
  // synthetic click on the data-testid="create-post" button rendered by renderHeaderActions.
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="create-post"]');
    btn?.click();
  }, []);
  return null;
}
