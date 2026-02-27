import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell, IconButton, Tooltip, Chip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { NavigationItem } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface SortableNavigationRowProps {
  item: NavigationItem;
  depth?: number;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
}

export default function SortableNavigationRow({ item, depth = 0, canWrite, isAdmin, onEdit, onDelete }: SortableNavigationRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const displayTitle = item.title || item.page_id || item.external_url || '\u2014';
  const depthPadding = depth * 24;

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <IconButton size="small" sx={{ cursor: 'grab' }} {...listeners} aria-label="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </TableCell>
      )}
      <TableCell sx={{ pl: `${16 + depthPadding}px` }}>
        {depth > 0 && <span style={{ color: 'var(--mui-palette-text-secondary)', marginRight: 4 }}>{'\u2514'}</span>}
        <span style={{ fontWeight: 500 }}>{displayTitle}</span>
      </TableCell>
      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.page_id || item.external_url || '\u2014'}</TableCell>
      <TableCell><Chip label={item.page_id ? t('common.labels.internal') : t('common.labels.external')} size="small" variant="outlined" /></TableCell>
      <TableCell>{item.icon || '\u2014'}</TableCell>
      <TableCell>{item.open_in_new_tab ? t('common.labels.yes') : t('common.labels.no')}</TableCell>
      <TableCell align="right">
        {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(item)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
        {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(item)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
      </TableCell>
    </TableRow>
  );
}
