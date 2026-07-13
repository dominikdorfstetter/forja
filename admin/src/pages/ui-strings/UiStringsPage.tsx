import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';

import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  FilterSelect,
  DataTableV2,
  Pagination,
  type DataTableV2Column,
  type FilterSelectOption,
} from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { createUiString, deleteUiString, getUiStringEntries, updateUiString } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateUiStringRequest, UiStringResponse, UpdateUiStringRequest } from '@/types/api';
import LocaleCoverageChips from './LocaleCoverageChips';
import UiStringRowActions from './UiStringRowActions';
import UiStringFormDialog from './UiStringFormDialog';
import {
  applyCoverageFilter,
  applyKeyQuery,
  orderedActiveLocales,
  type CoverageFilter,
} from './localeCoverage';

/**
 * UI strings list (roadmap §1): every key of the site's chrome dictionary
 * with per-locale completeness/status chips, a key search, "missing
 * translations" / "outdated" coverage filters, and client-side pagination
 * (one fetch returns all entries — the backend caps a site at 500 keys).
 * Create/edit happen in UiStringFormDialog; reads are Viewer+ (the dialog
 * opens read-only), mutations Editor+ (backend resource `ui_string`).
 */
export default function UiStringsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canEditAll } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();

  const [filter, setFilter] = useState<CoverageFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UiStringResponse | null>(null);
  const [deleting, setDeleting] = useState<UiStringResponse | null>(null);

  const { data: entries, isLoading, error } = useQuery({
    queryKey: queryKeys.uiStrings(siteId),
    queryFn: () => getUiStringEntries(siteId),
    enabled: !!siteId,
  });
  const { data: siteLocales } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
    enabled: !!siteId,
  });

  const locales = useMemo(() => orderedActiveLocales(siteLocales ?? []), [siteLocales]);
  const filtered = useMemo(
    () => applyKeyQuery(applyCoverageFilter(entries ?? [], locales, filter), search),
    [entries, locales, filter, search],
  );
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  const changeSearch = (next: string) => {
    setSearch(next);
    setPage(1);
  };
  const changeFilter = (next: CoverageFilter) => {
    setFilter(next);
    setPage(1);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.uiStrings(siteId) });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUiStringRequest) => createUiString(siteId, payload),
    onSuccess: () => {
      invalidate();
      showSuccess(t('uiStrings.dialog.created'));
      setCreateOpen(false);
    },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUiStringRequest }) =>
      updateUiString(siteId, id, payload),
    onSuccess: () => {
      invalidate();
      showSuccess(t('uiStrings.dialog.saved'));
      setEditing(null);
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (row: UiStringResponse) => deleteUiString(siteId, row.id),
    onSuccess: () => {
      invalidate();
      showSuccess(t('uiStrings.deleted'));
      setDeleting(null);
    },
    onError: (err) => {
      showError(err);
      setDeleting(null);
    },
  });

  const filterOptions: FilterSelectOption<CoverageFilter>[] = [
    { value: 'all', label: t('uiStrings.list.filterAll'), icon: 'filter_list' },
    { value: 'missing', label: t('uiStrings.list.filterMissing'), icon: 'translate' },
    { value: 'outdated', label: t('uiStrings.list.filterOutdated'), icon: 'history' },
  ];

  const columns: DataTableV2Column<UiStringResponse>[] = [
    {
      key: 'key',
      label: t('uiStrings.list.colKey'),
      width: '1fr',
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{row.key}</span>
      ),
    },
    {
      key: 'locales',
      label: t('uiStrings.list.colLocales'),
      width: '1.5fr',
      multiline: true,
      render: (row) => <LocaleCoverageChips row={row} locales={locales} />,
    },
    {
      key: 'updated',
      label: t('uiStrings.list.colUpdated'),
      width: '120px',
      muted: true,
      render: (row) => new Date(row.updated_at).toLocaleDateString(),
    },
  ];

  if (error) {
    return <Alert severity="error">{t('uiStrings.list.loadError')}</Alert>;
  }

  return (
    <Box data-testid="ui-strings.page">
      <PageHeader
        icon="translate"
        breadcrumb={`${t('layout.sidebar.structure')} / ${t('uiStrings.title')}`}
        title={t('uiStrings.title')}
        subtitle={t('uiStrings.subtitle')}
        actions={
          canEditAll ? (
            <M3Button
              size="md"
              icon="add"
              onClick={() => setCreateOpen(true)}
              data-testid="ui-strings.new"
            >
              {t('uiStrings.newString')}
            </M3Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (entries?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<TranslateIcon sx={{ fontSize: 38 }} />}
          title={t('uiStrings.list.emptyTitle')}
          description={t('uiStrings.list.empty')}
          action={
            canEditAll
              ? { label: t('uiStrings.newString'), onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={search}
              onChange={changeSearch}
              placeholder={t('uiStrings.list.searchPlaceholder')}
              ariaLabel={t('uiStrings.list.searchPlaceholder')}
              data-testid="ui-strings.search"
            />
            <ToolbarSpacer />
            <FilterSelect<CoverageFilter>
              value={filter}
              onChange={changeFilter}
              options={filterOptions}
              ariaLabel={t('uiStrings.list.filterLabel')}
              data-testid="ui-strings.filter"
            />
          </Toolbar>
          <DataTableV2<UiStringResponse>
            data-testid="ui-strings.table"
            columns={columns}
            rows={rows}
            getKey={(row) => row.id}
            onRowClick={setEditing}
            emptyMessage={t('uiStrings.list.noMatches')}
            renderActions={
              canEditAll
                ? (row) => (
                    <UiStringRowActions row={row} onEdit={setEditing} onDelete={setDeleting} />
                  )
                : undefined
            }
          />
          {filtered.length > 0 && (
            <Pagination
              total={filtered.length}
              page={page}
              perPage={perPage}
              onPage={setPage}
              onPerPage={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          )}
        </>
      )}

      <UiStringFormDialog
        open={createOpen}
        locales={locales}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onClose={() => setCreateOpen(false)}
        loading={createMutation.isPending}
      />
      <UiStringFormDialog
        open={!!editing}
        row={editing}
        locales={locales}
        readOnly={!canEditAll}
        onSubmitUpdate={(payload) => editing && updateMutation.mutate({ id: editing.id, payload })}
        onClose={() => setEditing(null)}
        loading={updateMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('uiStrings.deleteTitle')}
        message={t('uiStrings.deleteConfirm', { key: deleting?.key ?? '' })}
        confirmLabel={t('common.actions.delete')}
        confirmColor="error"
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
