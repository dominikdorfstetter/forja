import { Chip, IconButton, TableCell, TableRow, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { LegalItemResponse } from '@/types/api';
import { DragHandleCell, useSortableRow } from '@/components/shared/listPageV2';

interface CookieItemRowProps {
  item: LegalItemResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (item: LegalItemResponse) => void;
  onDelete: (item: LegalItemResponse) => void;
}

/** Sortable (drag-to-reorder) row of a cookie group's items table. */
export default function CookieItemRow({ item, canWrite, isAdmin, onEdit, onDelete }: CookieItemRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, style } = useSortableRow(item.id);

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid={`cookie-item.${item.id}`}>
      {canWrite && <DragHandleCell listeners={listeners} />}
      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.cookie_name}</TableCell>
      <TableCell>
        <Chip
          label={item.is_required ? t('common.labels.yes') : t('common.labels.no')}
          size="small"
          color={item.is_required ? 'warning' : 'default'}
          variant="outlined"
        />
      </TableCell>
      <TableCell align="right">
        {canWrite && (
          <Tooltip title={t('common.actions.edit')} aria-label={t('common.actions.edit')}>
            <IconButton size="small" onClick={() => onEdit(item)} data-testid={`cookie-item.edit.${item.id}`}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <Tooltip title={t('common.actions.delete')} aria-label={t('common.actions.delete')}>
            <IconButton size="small" color="error" onClick={() => onDelete(item)} data-testid={`cookie-item.delete.${item.id}`}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
