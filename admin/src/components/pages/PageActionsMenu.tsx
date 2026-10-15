import type { PageListItem } from '@/types/api';
import { ContentActionsMenu } from '@/components/shared/contentActionsMenu';

interface PageActionsMenuProps {
  page: PageListItem;
  canWrite: boolean;
  isAdmin: boolean;
  onView: (page: PageListItem) => void;
  onClone: (page: PageListItem) => void;
  onPublish: (page: PageListItem) => void;
  onUnpublish: (page: PageListItem) => void;
  onDelete: (page: PageListItem) => void;
  onArchive?: (page: PageListItem) => void;
  onRestore?: (page: PageListItem) => void;
  cloneDisabled?: boolean;
}

export default function PageActionsMenu({
  page,
  canWrite,
  isAdmin,
  onView,
  onClone,
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
  cloneDisabled,
}: PageActionsMenuProps) {
  return (
    <ContentActionsMenu
      item={page}
      canWrite={canWrite}
      isAdmin={isAdmin}
      testId="page-actions.btn.menu"
      handlers={{
        view: onView,
        publish: onPublish,
        unpublish: onUnpublish,
        clone: onClone,
        archive: onArchive,
        restore: onRestore,
      }}
      onDelete={onDelete}
      cloneDisabled={cloneDisabled}
    />
  );
}
