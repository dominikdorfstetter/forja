import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import DescriptionIcon from '@mui/icons-material/Description';
import { bulkPages, clonePage, createPage, deletePage, getPageStatusCounts, getPages, updatePage } from '@/services/pages';
import type {
  PageListItem,
  CreatePageRequest,
  PageResponse,
} from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import CreatePageWizard from '@/components/pages/CreatePageWizard';
import { ContentEntityActionMenu } from '@/components/shared/contentEntityActionMenu';
import { FilterSelect } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import EntityListPage, { ContentEntityDialogs } from '@/components/shared/entityListPage';
import type { EntityListAdapter } from '@/components/shared/entityListPage';
import { buildPagesColumns, buildPagesStatusChipFilters } from '@/pages/PagesTableConfig';
import { queryKeys } from '@/lib/queryKeys';
import { useSiteContext } from '@/store/SiteContext';

const TYPE_OPTIONS = ['Static', 'Landing', 'Contact', 'BlogIndex', 'Custom'] as const;

const pagesAdapter: EntityListAdapter<PageListItem, Awaited<ReturnType<typeof getPageStatusCounts>>> = {
  entityKey: 'page',
  pageHeaderIcon: 'description',
  i18nNamespace: 'pages',
  fetchList: (siteId, params) =>
    getPages(siteId, {
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      status: params.status,
      page_type: params.page_type as string | undefined,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      exclude_status: params.exclude_status,
    }),
  listQueryKey: (siteId, params) =>
    queryKeys.pages(
      siteId,
      params.page,
      params.page_size,
      params.search ?? '',
      params.status ?? '',
      params.page_type ?? '',
      params.sort_by ?? '',
      params.sort_dir ?? '',
      params.exclude_status ?? '',
    ),
  fetchStatusCounts: (siteId) => getPageStatusCounts(siteId),
  statusCountsQueryKey: (siteId) => queryKeys.pagesStatusCounts(siteId),
  bulkExtraInvalidations: (siteId) => [
    queryKeys.trashCount(siteId),
    queryKeys.trash(siteId),
    queryKeys.pagesStatusCounts(siteId),
  ],
  getItemId: (item) => item.id,
  updateEntity: (id, data) => updatePage(id, data),
  deleteEntity: (id) => deletePage(id),
  bulkAction: (siteId, request) => bulkPages(siteId, request),
  defaultSort: { sortBy: 'route', sortDir: 'asc' },
  buildColumns: (deps) => buildPagesColumns(deps),
  buildChipFilters: ({ t, workflowEnabled, counts }) => buildPagesStatusChipFilters(t, workflowEnabled, counts),
  pageTestId: 'pages.page',
  tableTestId: 'pages.table',
  searchTestId: 'pages-search',
  emptyIcon: <DescriptionIcon sx={{ fontSize: 64 }} />,
};

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { showError, enqueueSnackbar } = useErrorSnackbar();

  const [typeFilter, setTypeFilter] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: CreatePageRequest) => createPage(data),
    onSuccess: (result: PageResponse) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pages(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pagesStatusCounts(selectedSiteId) });
      enqueueSnackbar(t('pages.messages.created'), { variant: 'success' });
      navigate(`/pages/${result.id}`);
    },
    onError: showError,
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => clonePage(id),
    onSuccess: (pg) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pages(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pagesStatusCounts(selectedSiteId) });
      enqueueSnackbar(t('pages.messages.cloned'), { variant: 'success' });
      navigate(`/pages/${pg.id}`);
    },
    onError: showError,
  });

  // Command palette listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-page') {
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="create-page"]');
        btn?.click();
      }
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  return (
    <EntityListPage
      adapter={pagesAdapter}
      extraQueryParams={{ page_type: typeFilter || undefined }}
      extraQueryDeps={[typeFilter]}
      renderHeaderActions={({ canWrite, selectedSiteId: siteId, openCreate }) =>
        siteId && canWrite ? (
          <M3Button size="md" icon="add" onClick={openCreate} data-testid="create-page">
            {t('pages.createButton')}
          </M3Button>
        ) : null
      }
      renderToolbarExtras={() => (
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_OPTIONS.map((val) => ({
            value: val,
            label: t(`pages.wizard.types.${val.toLowerCase()}`, val),
          }))}
          placeholder={t('common.filters.allTypes', 'All types')}
          width={180}
          data-testid="pages-type-filter"
        />
      )}
      renderRowActions={({ item, canWrite, isAdmin, rowActions, onView, onDelete }) => (
        <ContentEntityActionMenu
          kind="page"
          entity={item}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onView={onView}
          onPublish={rowActions.openPublish}
          onUnpublish={rowActions.openUnpublish}
          onClone={(p) => cloneMutation.mutate(p.id)}
          onDelete={onDelete}
          onArchive={rowActions.openArchive}
          onRestore={rowActions.openRestore}
          cloneDisabled={cloneMutation.isPending}
        />
      )}
      renderCreateForm={({ formOpen, closeForm }) => (
        <CreatePageWizard
          open={formOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          onClose={closeForm}
          loading={createMutation.isPending}
        />
      )}
      renderDialogs={(props) => (
        <ContentEntityDialogs
          {...props}
          descriptor={{ i18nNamespace: 'pages', identifierField: 'route', restore: 'publishOrDraft' }}
        />
      )}
    />
  );
}
