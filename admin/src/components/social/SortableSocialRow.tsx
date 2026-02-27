import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell, IconButton, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SocialLink } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface SortableSocialRowProps {
  link: SocialLink;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (link: SocialLink) => void;
  onDelete: (link: SocialLink) => void;
}

export default function SortableSocialRow({ link, canWrite, isAdmin, onEdit, onDelete }: SortableSocialRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <IconButton size="small" sx={{ cursor: 'grab' }} {...listeners} aria-label="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </TableCell>
      )}
      <TableCell>{link.title}</TableCell>
      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url}</TableCell>
      <TableCell>{link.icon}</TableCell>
      <TableCell align="right">
        {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(link)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
        {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(link)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
      </TableCell>
    </TableRow>
  );
}
