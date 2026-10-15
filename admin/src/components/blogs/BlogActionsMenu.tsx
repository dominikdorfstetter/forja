import type { BlogListItem } from '@/types/api';
import { ContentActionsMenu } from '@/components/shared/contentActionsMenu';

interface BlogActionsMenuProps {
  blog: BlogListItem;
  canWrite: boolean;
  isAdmin: boolean;
  onView: (blog: BlogListItem) => void;
  onClone: (blog: BlogListItem) => void;
  onPublish: (blog: BlogListItem) => void;
  onUnpublish: (blog: BlogListItem) => void;
  onDelete: (blog: BlogListItem) => void;
  onArchive?: (blog: BlogListItem) => void;
  onRestore?: (blog: BlogListItem) => void;
  cloneDisabled?: boolean;
}

export default function BlogActionsMenu({
  blog,
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
}: BlogActionsMenuProps) {
  return (
    <ContentActionsMenu
      item={blog}
      canWrite={canWrite}
      isAdmin={isAdmin}
      testId="blog-actions.btn.menu"
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
