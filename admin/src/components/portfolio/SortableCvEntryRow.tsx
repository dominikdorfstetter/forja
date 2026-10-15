import { TableRow, TableCell } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import CvEntryActionsMenu, { type CvEntryActionsMenuProps } from './CvEntryActionsMenu';
import { DragHandleCell, useSortableRow } from '@/components/shared/listPageV2';

export default function SortableCvEntryRow(props: CvEntryActionsMenuProps) {
  const { entry, canWrite } = props;
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { attributes, listeners, setNodeRef, style } = useSortableRow(entry.id);

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="cv-entry-row">
      {canWrite && <DragHandleCell listeners={listeners} />}
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
        <CvEntryActionsMenu {...props} />
      </TableCell>
    </TableRow>
  );
}
