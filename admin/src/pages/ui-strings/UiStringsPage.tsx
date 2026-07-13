import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';

import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  FilterSelect,
  DataTableV2,
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
import { deleteUiString, getUiStringEntries } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { queryKeys } from '@/lib/queryKeys';
import type { UiStringResponse } from '@/types/api';
import LocaleCoverageChips from './LocaleCoverageChips';
import UiStringRowActions from './UiStringRowActions';
import { applyCoverageFilter, orderedActiveLocales, type CoverageFilter } from './localeCoverage';

/**
 * UI strings list (roadmap §1): every key of the site's chrome dictionary
 * with per-locale completeness/status chips, plus "missing translations"
 * and "outdated" coverage filters. Reads are Viewer+, mutations Editor+
 * (backend resource `ui_string`), so write affordances gate on canEditAll.
 */
export default function UiStringsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEditAll } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();

  const [filter, setFilter] = useState<CoverageFilter>('all');
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
  const rows = useMemo(
    () => applyCoverageFilter(entries ?? [], locales, filter),
    [entries, locales, filter],
  );

  const deleteMutation = useMutation({
    mutationFn: (row: UiStringResponse) => deleteUiString(siteId, row.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiStrings(siteId) });
      showSuccess(t('uiStrings.deleted'));
      setDeleting(null);
    },
    onError: (err) => {
      showError(err);
      setDeleting(null);
    },
  });

  const openDetail = (row: UiStringResponse) => navigate(`/ui-strings/${row.id}`);

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
              onClick={() => navigate('/ui-strings/new')}
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
              ? { label: t('uiStrings.newString'), onClick: () => navigate('/ui-strings/new') }
              : undefined
          }
        />
      ) : (
        <>
          <Toolbar>
            <ToolbarSpacer />
            <FilterSelect<CoverageFilter>
              value={filter}
              onChange={setFilter}
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
            onRowClick={openDetail}
            emptyMessage={t('uiStrings.list.noMatches')}
            renderActions={
              canEditAll
                ? (row) => (
                    <UiStringRowActions row={row} onEdit={openDetail} onDelete={setDeleting} />
                  )
                : undefined
            }
          />
        </>
      )}

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
