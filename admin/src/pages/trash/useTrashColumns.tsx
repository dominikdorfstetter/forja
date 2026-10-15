import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import { Icon } from '@/components/design-system';
import { daysUntilPurge, type TrashItem } from './trashItem';

const TYPE_ICONS: Record<string, string> = {
  blog: 'article',
  page: 'description',
  project: 'work',
  cv_entry: 'badge',
  skill: 'psychology',
  media: 'image',
  document: 'insert_drive_file',
  legal: 'gavel',
  social: 'share',
  menu: 'menu',
  menu_item: 'segment',
};

const TYPE_COLORS: Record<string, string> = {
  blog: '#b8a4ff',
  page: '#8ec5ff',
  project: '#9fd8c4',
  cv_entry: '#a4b8ff',
  skill: '#ffcf8a',
  media: '#ffc98a',
  document: '#7edac6',
  legal: '#ff9e9e',
  social: '#ff9e9e',
  menu: '#a59fb0',
  menu_item: '#a59fb0',
};

function TrashItemName({ item }: { item: TrashItem }) {
  const iconName = TYPE_ICONS[item.entity_type] ?? 'inventory_2';
  const color = TYPE_COLORS[item.entity_type] ?? 'var(--on-surface-variant)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: color + '26',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={iconName} size={16} color={color} />
      </span>
      <span
        style={{
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.title || item.slug || item.id}
      </span>
    </span>
  );
}

function PurgeCountdownChip({ deletedAt }: { deletedAt: TrashItem['deleted_at'] }) {
  const { t } = useTranslation();
  const days = daysUntilPurge(deletedAt);
  return (
    <Chip
      label={t('trash.daysRemaining', { days })}
      size="small"
      color={days <= 7 ? 'warning' : 'default'}
    />
  );
}

/** Column set of the Trash table: name (type-tinted icon), type, deletion time, purge countdown. */
export function useTrashColumns(): DataTableV2Column<TrashItem>[] {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();

  return [
    {
      key: 'name',
      label: t('common.table.name'),
      width: '1.4fr',
      render: (item) => <TrashItemName item={item} />,
    },
    {
      key: 'type',
      label: t('common.table.type'),
      width: '120px',
      render: (item) => (
        <Chip label={t(`trash.type.${item.entity_type}`)} size="small" variant="outlined" />
      ),
    },
    {
      key: 'deleted_at',
      label: t('trash.columnDeleted'),
      width: '160px',
      muted: true,
      render: (item) => (item.deleted_at ? fmt(item.deleted_at, 'PPp') : '—'),
    },
    {
      key: 'purge',
      label: t('trash.columnAutoPurge'),
      width: '140px',
      render: (item) => <PurgeCountdownChip deletedAt={item.deleted_at} />,
    },
  ];
}
