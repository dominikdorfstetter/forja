import type { ReactNode } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';
import {
  visibleContentMenuActions,
  type ContentMenuActionId,
  type ContentMenuHandlers,
} from './contentMenuActions';
import { RowKebabMenu } from './RowKebabMenu';

const ACTION_DISPLAY: Record<ContentMenuActionId, { icon: ReactNode; labelKey: string }> = {
  edit: { icon: <EditIcon fontSize="small" />, labelKey: 'common.actions.edit' },
  publish: { icon: <PublishIcon fontSize="small" />, labelKey: 'bulk.publish' },
  unpublish: { icon: <UnpublishedIcon fontSize="small" />, labelKey: 'bulk.unpublish' },
  archive: { icon: <ArchiveIcon fontSize="small" color="warning" />, labelKey: 'bulk.archive' },
  restore: { icon: <UnarchiveIcon fontSize="small" />, labelKey: 'bulk.restore' },
};

export interface ContentActionsMenuProps<T extends { status: ContentStatus }> {
  item: T;
  canWrite: boolean;
  isAdmin: boolean;
  /** data-testid of the kebab trigger, e.g. `project-actions.btn.menu`. */
  testId: string;
  /** Actions without a handler are never offered. */
  handlers: ContentMenuHandlers<T>;
  onDelete: (item: T) => void;
}

/** Kebab menu of publish-lifecycle actions for a content row. */
export function ContentActionsMenu<T extends { status: ContentStatus }>({
  item,
  canWrite,
  isAdmin,
  testId,
  handlers,
  onDelete,
}: ContentActionsMenuProps<T>) {
  const { t } = useTranslation();
  const entries = visibleContentMenuActions(item.status, canWrite, handlers).map(({ id, handler }) => ({
    id,
    icon: ACTION_DISPLAY[id].icon,
    label: t(ACTION_DISPLAY[id].labelKey),
    handler,
  }));

  return <RowKebabMenu item={item} isAdmin={isAdmin} testId={testId} entries={entries} onDelete={onDelete} />;
}
