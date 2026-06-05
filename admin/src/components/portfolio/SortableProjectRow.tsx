import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell, IconButton } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';
import type { ProjectResponse, ContentStatus } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { StatusPill } from '@/components/design-system';
import ProjectActionsMenu from './ProjectActionsMenu';

interface SortableProjectRowProps {
  project: ProjectResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (project: ProjectResponse) => void;
  onPublish: (project: ProjectResponse) => void;
  onUnpublish: (project: ProjectResponse) => void;
  onDelete: (project: ProjectResponse) => void;
  onArchive?: (project: ProjectResponse) => void;
  onRestore?: (project: ProjectResponse) => void;
}

export default function SortableProjectRow({
  project,
  canWrite,
  isAdmin,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
}: SortableProjectRowProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="project-row">
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <IconButton size="small" sx={{ cursor: 'grab' }} {...listeners} aria-label="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </TableCell>
      )}
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
        <ProjectActionsMenu
          project={project}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </TableCell>
    </TableRow>
  );
}
