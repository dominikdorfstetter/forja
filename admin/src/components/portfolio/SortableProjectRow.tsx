import { TableRow, TableCell } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { StatusPill } from '@/components/design-system';
import ProjectActionsMenu, { type ProjectActionsMenuProps } from './ProjectActionsMenu';
import { DragHandleCell, useSortableRow } from '@/components/shared/listPageV2';

export default function SortableProjectRow(props: ProjectActionsMenuProps) {
  const { project, canWrite } = props;
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { attributes, listeners, setNodeRef, style } = useSortableRow(project.id);

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="project-row">
      {canWrite && <DragHandleCell listeners={listeners} />}
      <TableCell>{project.slug}</TableCell>
      <TableCell>
        <span data-testid={`project-status-${project.id}`}>
          <StatusPill status={project.status as ContentStatus} size="sm" />
        </span>
      </TableCell>
      <TableCell>
        <span
          data-testid={`project-featured-${project.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 999,
            background: project.is_featured
              ? 'var(--primary-container)'
              : 'var(--surface-container-high)',
            border: project.is_featured
              ? '1px solid transparent'
              : '1px solid var(--outline-variant)',
            color: project.is_featured ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          {project.is_featured ? t('common.labels.yes') : t('common.labels.no')}
        </span>
      </TableCell>
      <TableCell>
        {project.start_date ? fmt(project.start_date, 'PP') : '\u2014'}
        {' - '}
        {project.is_ongoing
          ? t('common.labels.present')
          : (project.end_date ? fmt(project.end_date, 'PP') : '\u2014')}
      </TableCell>
      <TableCell align="right">
        <ProjectActionsMenu {...props} />
      </TableCell>
    </TableRow>
  );
}
