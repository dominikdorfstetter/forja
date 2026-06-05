import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip } from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useQuery } from '@tanstack/react-query';
import { createRedirect, deleteRedirect, getRedirects, updateRedirect } from '@/services/redirects';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RedirectFormDialog from '@/components/redirects/RedirectFormDialog';
import { isRedirectStatusCode, redirectChipProps } from '@/utils/redirectStatus';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';

function RedirectRowActions({
  redirect,
  canWrite,
  onEdit,
  onDelete,
}: {
  redirect: Redirect;
  canWrite: boolean;
  onEdit: (r: Redirect) => void;
  onDelete: (r: Redirect) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!canWrite) return null;

  const items: ActionMenuItem[] = [
    { icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(redirect) },
    {
      icon: 'delete',
      label: t('common.actions.delete'),
      danger: true,
      onClick: () => onDelete(redirect),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="redirect-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function RedirectsPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { selectedSiteId } = useSiteContext();
  const { canWrite } = useAuth();

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    formOpen,
    editing,
    deleting,
    search,
    setSearch,
    debouncedSearch,
    sortBy,
    sortDir,
    handleSort,
    openCreate,
    closeForm,
    closeEdit,
    openEdit,
    openDelete,
    closeDelete,
  } = useListPageState<Redirect>();

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-redirect') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: ['redirects', selectedSiteId, page, pageSize, debouncedSearch, sortBy, sortDir],
    queryFn: () =>
      getRedirects(selectedSiteId, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      }),
    enabled: !!selectedSiteId,
  });
  const redirects = data?.data;
  const total = data?.meta.total_items ?? 0;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    Omit<CreateRedirectRequest, 'site_id'>,
    UpdateRedirectRequest
  >({
    queryKey: 'redirects',
    create: {
      mutationFn: (req) => createRedirect(selectedSiteId, req),
      successMessage: t('redirects.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => updateRedirect(id, data),
      successMessage: t('redirects.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => deleteRedirect(id),
      successMessage: t('redirects.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  const columns: DataTableV2Column<Redirect>[] = [
    {
      key: 'source_path',
      label: t('redirects.table.sourcePath'),
      width: '1fr',
      sorted: sortedDir('source_path'),
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.source_path}
        </span>
      ),
    },
    {
      key: 'destination_path',
      label: t('redirects.table.destination'),
      width: '1fr',
      muted: true,
      sorted: sortedDir('destination_path'),
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.destination_path}
        </span>
      ),
    },
    {
      key: 'status_code',
      label: t('redirects.table.type'),
      width: '120px',
      sorted: sortedDir('status_code'),
      render: (r) => {
        const chip = isRedirectStatusCode(r.status_code)
          ? redirectChipProps(r.status_code, t)
          : { label: String(r.status_code), color: 'default' as const };
        return (
          <Chip label={chip.label} size="small" variant="outlined" color={chip.color} />
        );
      },
    },
    {
      key: 'is_active',
      label: t('redirects.table.status'),
      width: '100px',
      sorted: sortedDir('is_active'),
      render: (r) => (
        <Chip
          label={r.is_active ? t('common.status.active') : t('common.status.inactive')}
          size="small"
          color={r.is_active ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'created_at',
      label: t('redirects.table.created'),
      width: '120px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (r) => fmt(r.created_at, 'PP'),
    },
  ];

  const headerActions = selectedSiteId && canWrite ? (
    <M3Button size="md" icon="add" onClick={openCreate} data-testid="create-redirect">
      {t('redirects.addRedirect')}
    </M3Button>
  ) : undefined;

  return (
    <Box data-testid="redirects.page">
      <PageHeader
        icon="alt_route"
        breadcrumb={t('layout.sidebar.structure') + ' / ' + t('redirects.title')}
        title={t('redirects.title')}
        subtitle={t('redirects.subtitle')}
        actions={headerActions}
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<AltRouteIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('redirects.empty.noSite')}
        />
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('redirects.searchPlaceholder')}
              data-testid="redirects-search"
            />
            <ToolbarSpacer />
          </Toolbar>

          {isLoading ? (
            <LoadingState label={t('redirects.loading')} />
          ) : !redirects || redirects.length === 0 ? (
            <EmptyState
              icon={<AltRouteIcon sx={{ fontSize: 48 }} />}
              title={t('redirects.empty.title')}
              description={t('redirects.empty.description')}
              action={canWrite ? { label: t('redirects.addRedirect'), onClick: openCreate } : undefined}
            />
          ) : (
            <>
              <DataTableV2<Redirect>
                data-testid="redirects.table"
                columns={columns}
                rows={redirects}
                getKey={(r) => r.id}
                onSort={handleSort}
                renderActions={(r) => (
                  <RedirectRowActions
                    redirect={r}
                    canWrite={canWrite}
                    onEdit={openEdit}
                    onDelete={openDelete}
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
        </>
      )}

      <RedirectFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={closeForm}
        loading={createMutation.isPending}
      />
      <RedirectFormDialog
        open={!!editing}
        redirect={editing}
        onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })}
        onClose={closeEdit}
        loading={updateMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('redirects.deleteDialog.title')}
        message={t('redirects.deleteDialog.message', { source: deleting?.source_path })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
