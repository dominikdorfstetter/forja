import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell, IconButton } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';
import type { CvEntryResponse } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import CvEntryActionsMenu from './CvEntryActionsMenu';

interface SortableCvEntryRowProps {
  entry: CvEntryResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (entry: CvEntryResponse) => void;
  onDelete: (entry: CvEntryResponse) => void;
}

export default function SortableCvEntryRow({
  entry,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: SortableCvEntryRowProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="cv-entry-row">
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <IconButton size="small" sx={{ cursor: 'grab' }} {...listeners} aria-label="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </TableCell>
      )}
      <TableCell>{entry.company}</TableCell>
      <TableCell>{entry.location}</TableCell>
      <TableCell>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--surface-container-high)',
            border: '1px solid var(--outline-variant)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
            color: 'var(--on-surface)',
          }}
        >
          {entry.entry_type}
        </span>
      </TableCell>
      <TableCell>
        {fmt(entry.start_date, 'PP')}
        {' - '}
        {entry.is_current ? t('common.labels.present') : (entry.end_date ? fmt(entry.end_date, 'PP') : '\u2014')}
      </TableCell>
      <TableCell>
        {entry.is_current ? t('common.labels.yes') : t('common.labels.no')}
      </TableCell>
      <TableCell align="right">
        <CvEntryActionsMenu
          entry={entry}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}
