import type { ProjectResponse } from '@/types/api';
import { ContentActionsMenu } from '@/components/shared/contentActionsMenu';

/** Row callbacks a project list wires into each project's menu. */
export interface ProjectRowHandlers {
  onEdit: (project: ProjectResponse) => void;
  onPublish: (project: ProjectResponse) => void;
  onUnpublish: (project: ProjectResponse) => void;
  onDelete: (project: ProjectResponse) => void;
  onArchive?: (project: ProjectResponse) => void;
  onRestore?: (project: ProjectResponse) => void;
}

export interface ProjectActionsMenuProps extends ProjectRowHandlers {
  project: ProjectResponse;
  canWrite: boolean;
  isAdmin: boolean;
}

export default function ProjectActionsMenu({
  project,
  canWrite,
  isAdmin,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
}: ProjectActionsMenuProps) {
  return (
    <ContentActionsMenu
      item={project}
      canWrite={canWrite}
      isAdmin={isAdmin}
      testId="project-actions.btn.menu"
      handlers={{
        edit: onEdit,
        publish: onPublish,
        unpublish: onUnpublish,
        archive: onArchive,
        restore: onRestore,
      }}
      onDelete={onDelete}
    />
  );
}
