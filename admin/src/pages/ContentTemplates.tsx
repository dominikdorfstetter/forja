import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Box, IconButton, Link as MuiLink, Tooltip, Typography } from '@mui/material';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createContentTemplate, deleteContentTemplate, getContentTemplates, updateContentTemplate } from '@/services/contentTemplates';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type {
  ContentTemplate,
  CreateContentTemplateRequest,
  UpdateContentTemplateRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
} from '@/components/shared/listPageV2';
import { Icon, M3Button } from '@/components/design-system';
import ContentTemplateFormDialog from '@/components/content-templates/ContentTemplateFormDialog';
import CreateTemplateWizard from '@/components/content-templates/CreateTemplateWizard';

/**
 * Template `icon` values were written before the admin adopted Material
 * Symbols — they're stored in PascalCase (e.g. "NewReleases", a legacy
 * MUI icon-component name) while Material Symbols expects the ligature
 * text in snake_case ("new_releases"). The font silently renders the
 * raw string as overflowing text for anything it can't ligature, so
 * normalise the stored name here and fall back to a safe default.
 */
function toMaterialSymbol(name: string | undefined | null): string {
  if (!name) return 'article';
  if (/^[a-z][a-z0-9_]*$/.test(name)) return name;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function StatusPillLocal({ active, label }: { active: boolean; label: string }) {
  const paint = active
    ? { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)', border: 'none' }
    : {
        bg: 'var(--surface-container-high)',
        fg: 'var(--on-surface-variant)',
        border: '1px solid var(--outline-variant)',
      };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.1,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border,
        fontSize: 11,
        fontWeight: 600,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        letterSpacing: 0.3,
      }}
    >
      {label}
    </Box>
  );
}

export default function ContentTemplatesPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

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
    openEdit,
    closeEdit,
    openDelete,
    closeDelete,
  } = useListPageState<ContentTemplate>();

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-template') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'content-templates',
      selectedSiteId,
      page,
      pageSize,
      debouncedSearch,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getContentTemplates(selectedSiteId, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      }),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });
  const templates = data?.data ?? [];
  const total = data?.meta?.total_items ?? 0;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    Omit<CreateContentTemplateRequest, 'site_id'>,
    UpdateContentTemplateRequest
  >({
    queryKey: 'content-templates',
    create: {
      mutationFn: (req) => createContentTemplate(selectedSiteId, req),
      successMessage: t('contentTemplates.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => updateContentTemplate(id, data),
      successMessage: t('contentTemplates.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => deleteContentTemplate(id),
      successMessage: t('contentTemplates.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  const columns: DataTableV2Column<ContentTemplate>[] = [
    {
      key: 'name',
      label: t('contentTemplates.table.name'),
      width: '240px',
      sorted: sortedDir('name'),
      render: (tpl) => (
        <Typography
          component="span"
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 600, "opsz" 14',
          }}
        >
          {tpl.name}
        </Typography>
      ),
    },
    {
      key: 'description',
      label: t('contentTemplates.table.description'),
      width: '1fr',
      muted: true,
      render: (tpl) => (
        <Box
          component="span"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--on-surface-variant)',
          }}
        >
          {tpl.description || '—'}
        </Box>
      ),
    },
    {
      key: 'icon',
      label: t('contentTemplates.table.icon'),
      width: '80px',
      render: (tpl) => (
        <Tooltip title={tpl.icon} arrow>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '10px',
              bgcolor: 'var(--primary-container)',
              color: 'var(--on-primary-container)',
              overflow: 'hidden',
            }}
          >
            <Icon name={toMaterialSymbol(tpl.icon)} size={18} />
          </Box>
        </Tooltip>
      ),
    },
    {
      key: 'is_active',
      label: t('contentTemplates.table.active'),
      width: '120px',
      sorted: sortedDir('is_active'),
      render: (tpl) => (
        <StatusPillLocal
          active={tpl.is_active}
          label={tpl.is_active ? t('common.status.active') : t('common.status.inactive')}
        />
      ),
    },
    {
      key: 'created_at',
      label: t('contentTemplates.table.created'),
      width: '140px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (tpl) => fmt(tpl.created_at, 'PP'),
    },
  ];

  return (
    <Box data-testid="content-templates.page">
      <PageHeader
        icon="dynamic_form"
        breadcrumb={
          <>
            <MuiLink
              component={RouterLink}
              to="/blogs"
              underline="hover"
              sx={{ color: 'var(--on-surface-variant)' }}
            >
              {t('layout.sidebar.content')}
            </MuiLink>
            <span aria-hidden="true"> / </span>
            <MuiLink
              component={RouterLink}
              to="/blogs"
              underline="hover"
              sx={{ color: 'var(--on-surface-variant)' }}
            >
              {t('blogs.title')}
            </MuiLink>
            <span aria-hidden="true"> / </span>
            <span
              style={{
                color: 'var(--on-surface)',
                fontWeight: 600,
                fontVariationSettings: '"wght" 600, "opsz" 13',
              }}
            >
              {t('contentTemplates.title')}
            </span>
          </>
        }
        title={t('contentTemplates.title')}
        subtitle={t('contentTemplates.subtitle')}
        actions={
          selectedSiteId && canWrite ? (
            <M3Button size="md" icon="add" onClick={openCreate} data-testid="create-template">
              {t('contentTemplates.addTemplate')}
            </M3Button>
          ) : undefined
        }
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('contentTemplates.empty.noSite')}
        />
      ) : isLoading && templates.length === 0 ? (
        <LoadingState label={t('contentTemplates.loading')} />
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('contentTemplates.searchPlaceholder')}
              width={320}
              data-testid="content-templates.search"
            />
            <ToolbarSpacer />
          </Toolbar>

          {templates.length === 0 ? (
            <EmptyState
              icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />}
              title={t('contentTemplates.empty.title')}
              description={t('contentTemplates.empty.description')}
              action={
                canWrite
                  ? { label: t('contentTemplates.addTemplate'), onClick: openCreate }
                  : undefined
              }
            />
          ) : (
            <>
              <DataTableV2<ContentTemplate>
                data-testid="content-templates.table"
                columns={columns}
                rows={templates}
                getKey={(tpl) => tpl.id}
                onSort={handleSort}
                renderActions={(tpl) => (
                  <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
                    {canWrite && (
                      <Tooltip title={t('common.actions.edit')}>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(tpl)}
                          sx={{
                            width: 32,
                            height: 32,
                            color: 'var(--on-surface-variant)',
                            '&:hover': {
                              color: 'var(--on-surface)',
                              bgcolor: 'var(--surface-container-high)',
                            },
                          }}
                        >
                          <Icon name="edit" size={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip title={t('common.actions.delete')}>
                        <IconButton
                          size="small"
                          onClick={() => openDelete(tpl)}
                          sx={{
                            width: 32,
                            height: 32,
                            color: 'var(--err)',
                            '&:hover': {
                              bgcolor: 'color-mix(in srgb, var(--err) 14%, transparent)',
                            },
                          }}
                        >
                          <Icon name="delete" size={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
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

      <CreateTemplateWizard
        open={formOpen}
        onClose={closeForm}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
      <ContentTemplateFormDialog
        open={!!editing}
        template={editing}
        onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })}
        onClose={closeEdit}
        loading={updateMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('contentTemplates.deleteDialog.title')}
        message={t('contentTemplates.deleteDialog.message', { name: deleting?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
