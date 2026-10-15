import { useReducer, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getApiKeys } from '@/services/apiKeys';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { ApiKeyPermission, ApiKeyStatus } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import LoadingState from '@/components/shared/LoadingState';
import { Toolbar, ToolbarSpacer, SearchField, FilterSelect } from '@/components/shared/listPageV2';
import { SectionHead, M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';
import {
  hasActiveFilters,
  initialUIState,
  maxPermissionForRole,
  uiReducer,
} from './api-keys/apiKeysUiState';
import { useApiKeysMutations } from './api-keys/useApiKeysMutations';
import { useApiKeyColumns } from './api-keys/useApiKeyColumns';
import ApiKeysResults from './api-keys/ApiKeysResults';
import ApiKeysDialogs from './api-keys/ApiKeysDialogs';

const STATUS_OPTIONS: (ApiKeyStatus | '')[] = ['', 'Active', 'Blocked', 'Expired', 'Revoked'];
const PERMISSION_OPTIONS: (ApiKeyPermission | '')[] = ['', 'Admin', 'Write', 'Read'];

export default function ApiKeysPage() {
  const { t } = useTranslation();

  const { isMaster, isAdmin, currentSiteRole } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [ui, dispatch] = useReducer(uiReducer, initialUIState);
  const debouncedSearch = useDebouncedValue(ui.searchInput);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-api-key') dispatch({ type: 'openCreate' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  const columns = useApiKeyColumns(ui);

  const { data: apiKeysData, isLoading, error } = useQuery({
    queryKey: queryKeys.apiKeys(
      ui.statusFilter,
      ui.permissionFilter,
      debouncedSearch,
      ui.page,
      ui.pageSize,
      selectedSiteId,
      ui.sortBy,
      ui.sortDir,
    ),
    queryFn: () =>
      getApiKeys({
        status: ui.statusFilter || undefined,
        permission: ui.permissionFilter || undefined,
        search: debouncedSearch || undefined,
        site_id: selectedSiteId || undefined,
        page: ui.page,
        page_size: ui.pageSize,
        sort_by: ui.sortBy || undefined,
        sort_dir: ui.sortBy ? ui.sortDir : undefined,
      }),
    enabled: !!selectedSiteId,
  });

  const mutations = useApiKeysMutations(dispatch);

  if (isLoading) return <LoadingState label={t('apiKeys.loading')} />;
  if (error) return <Alert severity="error">{t('apiKeys.loadError')}</Alert>;

  return (
    <Box data-testid="api-keys.page">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <SectionHead
          icon="vpn_key"
          title={t('apiKeys.title')}
          subtitle={t('apiKeys.subtitle')}
        />
        {isAdmin && (
          <Box sx={{ mt: 0.5 }}>
            <M3Button
              size="md"
              icon="add"
              onClick={() => dispatch({ type: 'openCreate' })}
              data-testid="create-api-key"
            >
              {t('apiKeys.createButton')}
            </M3Button>
          </Box>
        )}
      </Box>

      <Toolbar>
        <SearchField
          value={ui.searchInput}
          onChange={(v) => dispatch({ type: 'setSearchInput', value: v })}
          placeholder={t('apiKeys.searchPlaceholder')}
          data-testid="api-keys-search"
        />
        <FilterSelect
          value={ui.statusFilter}
          onChange={(value) => dispatch({ type: 'setStatusFilter', value })}
          options={STATUS_OPTIONS.filter((s) => s !== '').map((s) => ({ value: s, label: s }))}
          placeholder={t('apiKeys.filters.allStatuses')}
          width={160}
          data-testid="api-keys-status-filter"
        />
        <FilterSelect
          value={ui.permissionFilter}
          onChange={(value) => dispatch({ type: 'setPermissionFilter', value })}
          options={PERMISSION_OPTIONS.filter((p) => p !== '').map((p) => ({ value: p, label: p }))}
          placeholder={t('apiKeys.filters.allPermissions')}
          width={160}
          data-testid="api-keys-permission-filter"
        />
        <ToolbarSpacer />
      </Toolbar>

      <ApiKeysResults
        ui={ui}
        dispatch={dispatch}
        columns={columns}
        apiKeys={apiKeysData?.data ?? []}
        total={apiKeysData?.meta.total_items ?? 0}
        showPagination={!!apiKeysData?.meta}
        filtersActive={hasActiveFilters(ui, debouncedSearch)}
        canCreate={isAdmin}
        onUnblock={(key) => mutations.unblockMutation.mutate(key.id)}
      />

      <ApiKeysDialogs
        ui={ui}
        dispatch={dispatch}
        siteId={selectedSiteId}
        maxPermission={maxPermissionForRole(currentSiteRole, isMaster)}
        mutations={mutations}
      />
    </Box>
  );
}
