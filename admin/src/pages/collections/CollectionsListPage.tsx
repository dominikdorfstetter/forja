/**
 * Collections landing page (#797): lists the site's custom types with a link
 * to build a new one, open a type's entries, edit its structure, or delete it.
 * Uses the shared list-page design system so it matches every other route.
 * Obeys the Layout chrome rule.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box, Chip } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';

import { useSiteContext } from '@/store/SiteContext';
import { useCustomTypes, useDeleteCustomType } from '@/hooks/useCustomTypes';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CustomTypeSummary } from '@/types/customTypes';
import {
  PageHeader,
  DataTableV2,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
  type DataTableV2Column,
} from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

function TypeRowActions({
  type,
  onOpen,
  onEdit,
  onDelete,
}: {
  type: CustomTypeSummary;
  onOpen: (t: CustomTypeSummary) => void;
  onEdit: (t: CustomTypeSummary) => void;
  onDelete: (t: CustomTypeSummary) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: ActionMenuItem[] = [
    { icon: 'list', label: t('collections.openEntries'), onClick: () => onOpen(type) },
    { icon: 'tune', label: t('collections.editStructure'), onClick: () => onEdit(type) },
    {
      icon: 'delete',
      label: t('collections.deleteType'),
      danger: true,
      onClick: () => onDelete(type),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="type-actions"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function CollectionsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();
  const { data: types, isLoading } = useCustomTypes(selectedSiteId);
  const del = useDeleteCustomType(siteId);
  const [deleting, setDeleting] = useState<CustomTypeSummary | null>(null);

  const openType = (ct: CustomTypeSummary) =>
    navigate(`/collections/${encodeURIComponent(ct.key)}`);
  const editType = (ct: CustomTypeSummary) =>
    navigate(`/collections/${encodeURIComponent(ct.key)}/edit`);

  const confirmDelete = () => {
    if (!deleting) return;
    del.mutate(
      { key: deleting.key },
      {
        onSuccess: () => {
          showSuccess(t('collections.typeDeleted'));
          setDeleting(null);
        },
        onError: (e) => {
          showError(e);
          setDeleting(null);
        },
      },
    );
  };

  const columns: DataTableV2Column<CustomTypeSummary>[] = [
    { key: 'name', label: t('collections.name'), width: '1.5fr', render: (ct) => ct.name },
    {
      key: 'key',
      label: t('collections.key'),
      width: '1fr',
      muted: true,
      render: (ct) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{ct.key}</span>
      ),
    },
    {
      key: 'fields',
      label: t('collections.colFields'),
      width: '100px',
      muted: true,
      render: (ct) => ct.field_count,
    },
    {
      key: 'kind',
      label: t('collections.contentKind'),
      width: '160px',
      render: (ct) =>
        ct.content_kind === 'page' ? (
          <Chip size="small" variant="outlined" label={t('collections.kindPage')} />
        ) : (
          <Chip size="small" variant="outlined" label={t('collections.kindData')} />
        ),
    },
  ];

  const newButton = (
    <M3Button
      size="md"
      icon="add"
      onClick={() => navigate('/collections/new')}
      data-testid="new-collection"
    >
      {t('collections.newType')}
    </M3Button>
  );

  return (
    <Box data-testid="collections.page">
      <PageHeader
        icon="category"
        breadcrumb={`${t('layout.sidebar.content')} / ${t('collections.title')}`}
        title={t('collections.title')}
        subtitle={t('collections.subtitle')}
        actions={newButton}
      />

      {isLoading ? (
        <LoadingState />
      ) : (types?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CategoryIcon sx={{ fontSize: 38 }} />}
          title={t('collections.emptyTitle')}
          description={t('collections.empty')}
          action={{ label: t('collections.newType'), onClick: () => navigate('/collections/new') }}
        />
      ) : (
        <DataTableV2<CustomTypeSummary>
          data-testid="collections-list"
          columns={columns}
          rows={types ?? []}
          getKey={(ct) => ct.id}
          onRowClick={openType}
          renderActions={(ct) => (
            <TypeRowActions type={ct} onOpen={openType} onEdit={editType} onDelete={setDeleting} />
          )}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('collections.deleteType')}
        message={t('collections.deleteTypeConfirm', { name: deleting?.name ?? '' })}
        confirmLabel={t('common.actions.delete')}
        confirmColor="error"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={del.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
