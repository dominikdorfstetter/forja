/**
 * Per-type entry list (#798): loading / empty / error states, a status filter,
 * per-row actions (edit / publish / unpublish / delete), and links to create
 * an entry or edit the type's structure. Uses the shared list-page design
 * system. Obeys the Layout chrome rule.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Alert, Box, Chip } from '@mui/material';

import { useSiteContext } from '@/store/SiteContext';
import { useCustomEntries, useCustomEntryMutations, useCustomType } from '@/hooks/useCustomTypes';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CustomEntrySummary } from '@/types/customTypes';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  FilterSelect,
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
import { CollectionsBreadcrumb } from './CollectionsBreadcrumb';

function EntryRowActions({
  entry,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  entry: CustomEntrySummary;
  onEdit: (e: CustomEntrySummary) => void;
  onPublish: (e: CustomEntrySummary) => void;
  onUnpublish: (e: CustomEntrySummary) => void;
  onDelete: (e: CustomEntrySummary) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: ActionMenuItem[] = [
    { icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(entry) },
    entry.status === 'published'
      ? { icon: 'unpublished', label: t('collections.unpublish'), onClick: () => onUnpublish(entry) }
      : { icon: 'publish', label: t('collections.publish'), onClick: () => onPublish(entry) },
    {
      icon: 'delete',
      label: t('collections.deleteEntry'),
      danger: true,
      onClick: () => onDelete(entry),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="entry-actions"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function CollectionEntriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { typeKey = '' } = useParams();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<CustomEntrySummary | null>(null);

  const { data: type } = useCustomType(selectedSiteId, typeKey);
  const { data, isLoading, isError } = useCustomEntries(siteId, typeKey, {
    status: status || undefined,
  });
  const mutations = useCustomEntryMutations(siteId, typeKey);

  const typeName = type?.name ?? typeKey;
  const entries = data?.data ?? [];

  const openEntry = (entry: CustomEntrySummary) =>
    navigate(`/collections/${encodeURIComponent(typeKey)}/entries/${entry.id}`);

  const publish = (entry: CustomEntrySummary) =>
    mutations.publish.mutate(entry.id, {
      onSuccess: () => showSuccess(t('collections.entryPublished')),
      onError: showError,
    });
  const unpublish = (entry: CustomEntrySummary) =>
    mutations.unpublish.mutate(entry.id, {
      onSuccess: () => showSuccess(t('collections.entryUnpublished')),
      onError: showError,
    });
  const confirmDelete = () => {
    if (!deleting) return;
    mutations.remove.mutate(deleting.id, {
      onSuccess: () => {
        showSuccess(t('collections.entryDeleted'));
        setDeleting(null);
      },
      onError: (e) => {
        showError(e);
        setDeleting(null);
      },
    });
  };

  const columns: DataTableV2Column<CustomEntrySummary>[] = [
    {
      key: 'title',
      label: t('collections.colTitle'),
      width: '1.5fr',
      render: (e) => e.title ?? e.slug ?? e.id,
    },
    {
      key: 'slug',
      label: t('collections.colSlug'),
      width: '1fr',
      muted: true,
      render: (e) =>
        e.slug ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{e.slug}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      label: t('collections.status'),
      width: '120px',
      render: (e) => (
        <Chip
          size="small"
          label={e.status}
          color={e.status === 'published' ? 'success' : 'default'}
        />
      ),
    },
  ];

  const headerActions = (
    <>
      <M3Button
        variant="outlined"
        size="md"
        icon="tune"
        onClick={() => navigate(`/collections/${encodeURIComponent(typeKey)}/edit`)}
        data-testid="edit-structure"
      >
        {t('collections.editStructure')}
      </M3Button>
      <M3Button
        size="md"
        icon="add"
        onClick={() => navigate(`/collections/${encodeURIComponent(typeKey)}/entries/new`)}
        data-testid="new-entry"
      >
        {t('collections.newEntry')}
      </M3Button>
    </>
  );

  return (
    <Box data-testid="collections.entries.page">
      <PageHeader
        icon="category"
        breadcrumb={
          <CollectionsBreadcrumb
            crumbs={[
              { label: t('collections.title'), to: '/collections' },
              { label: typeName },
            ]}
          />
        }
        title={typeName}
        actions={headerActions}
      />

      <Toolbar>
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder={t('collections.allStatuses')}
          ariaLabel={t('collections.status')}
          data-testid="entry-status-filter"
          options={[
            { value: 'draft', label: t('collections.statusDraft') },
            { value: 'published', label: t('collections.statusPublished') },
          ]}
        />
        <ToolbarSpacer />
      </Toolbar>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <Alert severity="error">{t('common.error', 'Something went wrong')}</Alert>
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('collections.noEntries')}
          description={t('collections.noEntriesDesc')}
          action={{
            label: t('collections.newEntry'),
            onClick: () => navigate(`/collections/${encodeURIComponent(typeKey)}/entries/new`),
          }}
        />
      ) : (
        <DataTableV2<CustomEntrySummary>
          data-testid="entries-list"
          columns={columns}
          rows={entries}
          getKey={(e) => e.id}
          onRowClick={openEntry}
          renderActions={(entry) => (
            <EntryRowActions
              entry={entry}
              onEdit={openEntry}
              onPublish={publish}
              onUnpublish={unpublish}
              onDelete={setDeleting}
            />
          )}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('collections.deleteEntry')}
        message={t('collections.deleteEntryConfirm', {
          title: deleting?.title ?? deleting?.slug ?? '',
        })}
        confirmLabel={t('common.actions.delete')}
        confirmColor="error"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={mutations.remove.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
