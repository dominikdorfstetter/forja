import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/shared/EmptyState';
import { DataTableV2, type DataTableV2Column, Pagination } from '@/components/shared/listPageV2';
import type { AuditLogEntry } from '@/types/api';

interface ActivityLogResultsProps {
  rows: AuditLogEntry[];
  columns: DataTableV2Column<AuditLogEntry>[];
  filtered: boolean;
  total: number;
  page: number;
  pageSize: number;
  onSort: (key: string) => void;
  onPage: (page: number) => void;
  onPerPage: (pageSize: number) => void;
}

/** Activity-log table + pagination, or the (filter-aware) empty state. */
export default function ActivityLogResults({
  rows,
  columns,
  filtered,
  total,
  page,
  pageSize,
  onSort,
  onPage,
  onPerPage,
}: ActivityLogResultsProps) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <EmptyState
        title={filtered ? t('activity.noFilterResults') : t('activity.empty')}
        description={filtered ? t('activity.noFilterResultsDescription') : t('activity.emptyDescription')}
      />
    );
  }

  return (
    <>
      <DataTableV2<AuditLogEntry>
        data-testid="activity.table"
        columns={columns}
        rows={rows}
        getKey={(log) => log.id}
        onSort={onSort}
      />
      <Pagination total={total} page={page} perPage={pageSize} onPage={onPage} onPerPage={onPerPage} />
    </>
  );
}
