import { Box, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Toolbar, ToolbarSpacer, FilterSelect } from '@/components/shared/listPageV2';
import { Icon } from '@/components/design-system';
import type { AiUsageCount } from '@/types/api';
import {
  ACTION_DB_NAME,
  ACTION_TYPES,
  ENTITY_TYPES,
  type ActivityLogFilters,
  type Timeframe,
} from './activityLogConfig';

function AiUsageBadge({ aiUsage }: { aiUsage: AiUsageCount }) {
  const { t } = useTranslation();
  return (
    <Tooltip title={`${t('activity.aiUsage.last30d')}: ${aiUsage.last_30_days}`} arrow>
      <Box
        component="span"
        data-testid="activity.ai-usage"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          height: 32,
          borderRadius: 999,
          bgcolor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          color: 'var(--primary)',
          border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
          fontSize: 12,
          fontWeight: 600,
          fontVariationSettings: '"wght" 600, "opsz" 12',
          letterSpacing: 0.2,
        }}
      >
        <Icon name="auto_awesome" size={16} filled />
        {t('activity.aiUsage.label')} {aiUsage.total} {t('activity.aiUsage.totalSuffix')}
      </Box>
    </Tooltip>
  );
}

interface ActivityLogToolbarProps {
  filters: ActivityLogFilters;
  onFiltersChange: (patch: Partial<ActivityLogFilters>) => void;
  aiUsage: AiUsageCount | undefined;
}

export default function ActivityLogToolbar({ filters, onFiltersChange, aiUsage }: ActivityLogToolbarProps) {
  const { t } = useTranslation();

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: 'all', label: t('activity.filters.all') },
    { value: '24h', label: t('activity.filters.last24h') },
    { value: '7d', label: t('activity.filters.last7d') },
    { value: '30d', label: t('activity.filters.last30d') },
  ];

  return (
    <Toolbar>
      <FilterSelect
        value={filters.timeframe}
        onChange={(v) => onFiltersChange({ timeframe: v as Timeframe })}
        options={timeframeOptions}
        placeholder={t('activity.filters.timeframe')}
        width={200}
        data-testid="activity.timeframe-filter"
      />
      <FilterSelect
        value={filters.action}
        onChange={(v) => onFiltersChange({ action: v })}
        options={ACTION_TYPES.map((a) => ({
          value: ACTION_DB_NAME[a],
          label: t(`activity.actions.${a}`, a),
        }))}
        placeholder={`${t('activity.filters.action')}: ${t('common.filters.all')}`}
        width={200}
        data-testid="activity.action-filter"
      />
      <FilterSelect
        value={filters.entity}
        onChange={(v) => onFiltersChange({ entity: v })}
        options={ENTITY_TYPES.map((et) => ({
          value: et,
          label: t(`activity.entities.${et}`, et),
        }))}
        placeholder={`${t('activity.filters.entityType')}: ${t('common.filters.all')}`}
        width={220}
        data-testid="activity.entity-filter"
      />
      <ToolbarSpacer />
      {aiUsage && aiUsage.total > 0 && <AiUsageBadge aiUsage={aiUsage} />}
    </Toolbar>
  );
}
