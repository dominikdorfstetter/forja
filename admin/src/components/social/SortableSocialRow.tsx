import { TableRow, TableCell, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SocialLink } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { DragHandleCell, useSortableRow } from '@/components/shared/listPageV2';

interface SortableSocialRowProps {
  link: SocialLink;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (link: SocialLink) => void;
  onDelete: (link: SocialLink) => void;
}

export default function SortableSocialRow({ link, canWrite, isAdmin, onEdit, onDelete }: SortableSocialRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, style } = useSortableRow(link.id);

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="social-link-row">
      {canWrite && <DragHandleCell listeners={listeners} />}
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
