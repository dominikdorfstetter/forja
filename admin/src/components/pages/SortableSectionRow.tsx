import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { PageSectionResponse } from '@/types/api';

interface SortableSectionRowProps {
  section: PageSectionResponse;
  localeChips: string[];
  primaryTitle: string | null;
  subtitle: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (section: PageSectionResponse) => void;
  onDelete: (section: PageSectionResponse) => void;
}

export default function SortableSectionRow({
  section,
  localeChips,
  primaryTitle,
  subtitle,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: SortableSectionRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

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
      <TableCell>
        <Chip label={section.section_type} size="small" variant="outlined" color="primary" />
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 300 }}>
            {primaryTitle || <Typography component="span" variant="body2" color="text.secondary">—</Typography>}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        {localeChips.length > 0 ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {localeChips.map((code) => (
              <Chip key={code} label={code} size="small" color="info" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {canWrite && (
          <Tooltip title={t('common.actions.edit')}>
            <IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(section)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <Tooltip title={t('common.actions.delete')}>
            <IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(section)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
