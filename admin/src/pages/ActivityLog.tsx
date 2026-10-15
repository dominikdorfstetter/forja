import { useMemo, useState } from 'react';
import { Box, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAuditAiUsage, getAuditLogs } from '@/services/audit';
import { getClerkUsers } from '@/services/clerkUsers';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import LoadingState from '@/components/shared/LoadingState';
import { PageHeader } from '@/components/shared/listPageV2';
import type { AuditLogEntry } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  buildUserNameMap,
  hasActiveFilters,
  timeframeFrom,
  type ActivityLogFilters,
} from './activity-log/activityLogConfig';
import { useActivityLogColumns } from './activity-log/useActivityLogColumns';
import ActivityLogToolbar from './activity-log/ActivityLogToolbar';
import ActivityLogResults from './activity-log/ActivityLogResults';

const INITIAL_FILTERS: ActivityLogFilters = { action: '', entity: '', timeframe: 'all' };

function ActivityLogHeader() {
  const { t } = useTranslation();
  return (
    <PageHeader
      icon="history"
      breadcrumb={t('layout.sidebar.administration') + ' / ' + t('activity.title')}
      title={t('activity.title')}
      subtitle={t('activity.subtitle')}
    />
  );
}

export default function ActivityLogPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { page, setPage, pageSize, setPageSize, sortBy, sortDir, handleSort } =
    useListPageState();
  const [filters, setFilters] = useState<ActivityLogFilters>(INITIAL_FILTERS);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auditLogs(selectedSiteId, page, pageSize, sortBy, sortDir, filters.action, filters.entity, filters.timeframe),
    queryFn: () =>
      getAuditLogs(selectedSiteId, {
        page,
        page_size: pageSize,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
        action: filters.action || undefined,
        entity_type: filters.entity || undefined,
        from_date: timeframeFrom(filters.timeframe),
      }),
    enabled: !!selectedSiteId,
  });

  const { data: clerkUsers } = useQuery({
    queryKey: queryKeys.clerkUsers(),
    queryFn: () => getClerkUsers({ limit: 200 }),
  });

  const { data: aiUsage } = useQuery({
    queryKey: queryKeys.auditAiUsage(selectedSiteId),
    queryFn: () => getAuditAiUsage(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const userNameMap = useMemo(() => buildUserNameMap(clerkUsers?.data), [clerkUsers]);
  const columns = useActivityLogColumns({ sortBy, sortDir, userNameMap });

  if (!selectedSiteId) {
    return (
      <Box>
        <ActivityLogHeader />
        <Alert severity="info">{t('common.noSiteSelected')}</Alert>
      </Box>
    );
  }

  const rows: AuditLogEntry[] = data?.data ?? [];

  const handleFiltersChange = (patch: Partial<ActivityLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handlePerPage = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  return (
    <Box data-testid="activity.page">
      <ActivityLogHeader />

      {isLoading && rows.length === 0 ? (
        <LoadingState label={t('activity.loading')} />
      ) : (
        <>
          <ActivityLogToolbar filters={filters} onFiltersChange={handleFiltersChange} aiUsage={aiUsage} />
          <ActivityLogResults
            rows={rows}
            columns={columns}
            filtered={hasActiveFilters(filters)}
            total={data?.meta?.total_items || 0}
            page={page}
            pageSize={pageSize}
            onSort={handleSort}
            onPage={setPage}
            onPerPage={handlePerPage}
          />
        </>
      )}
    </Box>
  );
}
