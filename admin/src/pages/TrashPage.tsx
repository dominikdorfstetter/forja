import { Box, Alert } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { getTrash } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { PageHeader, DataTableV2, Pagination } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';
import type { TrashItem } from './trash/trashItem';
import { useTrashColumns } from './trash/useTrashColumns';
import { useTrashActions } from './trash/useTrashActions';
import TrashRowActions from './trash/TrashRowActions';
import TrashBatchBar from './trash/TrashBatchBar';
import TrashConfirmDialog from './trash/TrashConfirmDialog';

export default function TrashPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { isAdmin, canWrite } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSiteId, setPrevSiteId] = useState(selectedSiteId);

  // Reset to the first page when the active site changes. Adjusting state
  // during render is React's recommended alternative to a syncing effect — it
  // runs before the query fires, so we never fetch a stale page for the new
  // site.
  if (selectedSiteId !== prevSiteId) {
    setPrevSiteId(selectedSiteId);
    setPage(1);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.trash(selectedSiteId, page, pageSize),
    queryFn: () => getTrash(selectedSiteId, page, pageSize),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const items: TrashItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const changePageSize = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const actions = useTrashActions(selectedSiteId, items);
  const columns = useTrashColumns();

  if (isLoading) return <LoadingState />;
  if (error) return <Alert severity="error">{t('common.errors.loadFailed')}</Alert>;

  const headerActions = isAdmin && items.length > 0 ? (
    <M3Button
      variant="filled"
      size="md"
      icon="delete_sweep"
      danger
      onClick={actions.requestDeleteAll}
      disabled={actions.isBusy}
      data-testid="trash.delete-all"
    >
      {t('trash.emptyTrash')}
    </M3Button>
  ) : undefined;

  return (
    <Box data-testid="trash.page">
      <PageHeader
        icon="delete"
        breadcrumb={t('trash.title')}
        title={t('trash.title')}
        subtitle={t('trash.subtitle')}
        actions={headerActions}
      />

      {total === 0 ? (
        <EmptyState icon={<DeleteOutlineIcon sx={{ fontSize: 48 }} />} title={t('trash.empty')} />
      ) : (
        <>
          <TrashBatchBar
            selectedCount={actions.selected.size}
            canWrite={canWrite}
            isAdmin={isAdmin}
            busy={actions.isBusy}
            onRestore={actions.restoreSelected}
            onDelete={actions.requestDeleteSelected}
          />

          <DataTableV2<TrashItem>
            data-testid="trash.table"
            columns={columns}
            rows={items}
            getKey={(item) => item.id}
            selected={actions.selected}
            onToggleSelect={actions.toggleSelect}
            onToggleAll={actions.toggleSelectAll}
            renderActions={(item) => (
              <TrashRowActions
                item={item}
                isAdmin={isAdmin}
                canWrite={canWrite}
                busy={actions.isBusy}
                onRestore={actions.restoreOne}
                onDeleteOne={actions.requestDeleteOne}
              />
            )}
          />

          <Pagination
            total={total}
            page={page}
            perPage={pageSize}
            onPage={setPage}
            onPerPage={changePageSize}
          />
        </>
      )}

      <TrashConfirmDialog
        action={actions.confirmAction}
        itemCount={items.length}
        loading={actions.isDeleting}
        onConfirm={actions.executeConfirmedDelete}
        onCancel={actions.cancelConfirm}
      />
    </Box>
  );
}
