import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import KeyIcon from '@mui/icons-material/Key';
import type { ApiKeyListItem } from '@/types/api';
import EmptyState from '@/components/shared/EmptyState';
import { ApiKeyActionsMenuV2 } from '@/components/api-keys/ApiKeyActionsMenuV2';
import { DataTableV2, Pagination, type DataTableV2Column } from '@/components/shared/listPageV2';
import { sortActionFor, type UIAction, type UIState } from './apiKeysUiState';

interface ApiKeysResultsProps {
  ui: UIState;
  dispatch: Dispatch<UIAction>;
  columns: DataTableV2Column<ApiKeyListItem>[];
  apiKeys: ApiKeyListItem[];
  total: number;
  showPagination: boolean;
  filtersActive: boolean;
  canCreate: boolean;
  onUnblock: (key: ApiKeyListItem) => void;
}

/** The API keys table with pagination, or the empty state when nothing matches. */
export default function ApiKeysResults({
  ui,
  dispatch,
  columns,
  apiKeys,
  total,
  showPagination,
  filtersActive,
  canCreate,
  onUnblock,
}: ApiKeysResultsProps) {
  const { t } = useTranslation();

  if (apiKeys.length === 0) {
    return (
      <EmptyState
        icon={<KeyIcon sx={{ fontSize: 64 }} />}
        title={t('apiKeys.empty.title')}
        description={filtersActive ? t('apiKeys.empty.filterHint') : t('apiKeys.empty.description')}
        action={
          !filtersActive && canCreate
            ? { label: t('apiKeys.createButton'), onClick: () => dispatch({ type: 'openCreate' }) }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <DataTableV2<ApiKeyListItem>
        data-testid="api-keys.table"
        columns={columns}
        rows={apiKeys}
        getKey={(k) => k.id}
        onSort={(column) => dispatch(sortActionFor(ui, column))}
        renderActions={(k) => (
          <ApiKeyActionsMenuV2
            apiKey={k}
            onEdit={(key) => dispatch({ type: 'openEdit', key })}
            onBlock={(key) => dispatch({ type: 'openBlock', key })}
            onUnblock={onUnblock}
            onRevoke={(key) => dispatch({ type: 'openRevoke', key })}
            onDelete={(key) => dispatch({ type: 'openDelete', key })}
            onViewUsage={(key) => dispatch({ type: 'openUsage', key })}
          />
        )}
      />
      {showPagination && (
        <Pagination
          total={total}
          page={ui.page}
          perPage={ui.pageSize}
          onPage={(next) => dispatch({ type: 'setPage', value: next })}
          onPerPage={(next) => dispatch({ type: 'setPageSize', value: next })}
        />
      )}
    </>
  );
}
