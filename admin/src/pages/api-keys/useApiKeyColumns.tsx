import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSites } from '@/services/sites';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { ApiKeyListItem } from '@/types/api';
import StatusChip from '@/components/shared/StatusChip';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import { queryKeys } from '@/lib/queryKeys';
import type { UIState } from './apiKeysUiState';

/** Column definitions for the API keys table, with the active sort marked. */
export function useApiKeyColumns({ sortBy, sortDir }: Pick<UIState, 'sortBy' | 'sortDir'>): DataTableV2Column<ApiKeyListItem>[] {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();

  const { data: sites } = useQuery({
    queryKey: queryKeys.sites(),
    queryFn: () => getSites(),
  });
  const siteMap = new Map((sites || []).map((s) => [s.id, s.name]));

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  return [
    {
      key: 'name',
      label: t('apiKeys.table.name'),
      width: '1.2fr',
      sorted: sortedDir('name'),
      render: (k) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{k.name}</span>,
    },
    {
      key: 'key_prefix',
      label: t('apiKeys.table.keyPrefix'),
      width: '140px',
      muted: true,
      render: (k) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{k.key_prefix}…</span>
      ),
    },
    {
      key: 'site',
      label: t('apiKeys.table.site'),
      width: '160px',
      muted: true,
      render: (k) => siteMap.get(k.site_id) || k.site_id.slice(0, 8) + '…',
    },
    {
      key: 'permission',
      label: t('apiKeys.table.permission'),
      width: '110px',
      sorted: sortedDir('permission'),
      render: (k) => <StatusChip value={k.permission} />,
    },
    {
      key: 'status',
      label: t('apiKeys.table.status'),
      width: '110px',
      sorted: sortedDir('status'),
      render: (k) => <StatusChip value={k.status} />,
    },
    {
      key: 'total_requests',
      label: t('apiKeys.table.requests'),
      width: '100px',
      align: 'right',
      sorted: sortedDir('total_requests'),
      render: (k) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {k.total_requests.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      label: t('apiKeys.table.lastUsed'),
      width: '140px',
      muted: true,
      sorted: sortedDir('last_used_at'),
      render: (k) =>
        k.last_used_at ? fmt(k.last_used_at, 'PP') : t('common.labels.never'),
    },
  ];
}
