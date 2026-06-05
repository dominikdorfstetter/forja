import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';
import {
  ActionMenu,
  RowActionBtn,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';
import {
  transitionsByKind,
  type ContentEntityKind,
} from './transitions';

export interface ContentEntity {
  id: string;
  status: ContentStatus;
}

export interface ContentEntityActionMenuProps<T extends ContentEntity> {
  kind: ContentEntityKind;
  entity: T;
  canWrite: boolean;
  isAdmin: boolean;
  onView: (entity: T) => void;
  onPublish: (entity: T) => void;
  onUnpublish: (entity: T) => void;
  onArchive: (entity: T) => void;
  onRestore: (entity: T) => void;
  onDelete: (entity: T) => void;
  onClone?: (entity: T) => void;
  cloneDisabled?: boolean;
}

export function ContentEntityActionMenu<T extends ContentEntity>({
  kind,
  entity,
  canWrite,
  isAdmin,
  onView,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onDelete,
  onClone,
  cloneDisabled,
}: ContentEntityActionMenuProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const rules = transitionsByKind[kind];
  const canPublish = canWrite && rules.canPublishFrom.includes(entity.status);
  const canUnpublish = canWrite && rules.canUnpublishFrom.includes(entity.status);
  const canArchive = canWrite && rules.canArchiveFrom.includes(entity.status);
  const canRestore = canWrite && rules.canRestoreFrom.includes(entity.status);
  const canClone = canWrite && rules.supportsClone && !!onClone;

  const items: ActionMenuItem[] = [
    { icon: 'visibility', label: t('common.actions.viewDetails'), onClick: () => onView(entity) },
    ...(canPublish
      ? [{ icon: 'publish', label: t('bulk.publish'), onClick: () => onPublish(entity) }]
      : []),
    ...(canUnpublish
      ? [{ icon: 'unpublished', label: t('bulk.unpublish'), onClick: () => onUnpublish(entity) }]
      : []),
    ...(canClone
      ? [{
          icon: 'content_copy',
          label: t('common.actions.clone'),
          onClick: () => onClone!(entity),
          disabled: cloneDisabled,
        }]
      : []),
    ...(canArchive
      ? [{ icon: 'archive', label: t('bulk.archive'), onClick: () => onArchive(entity) }]
      : []),
    ...(canRestore
      ? [{ icon: 'unarchive', label: t('bulk.restore'), onClick: () => onRestore(entity) }]
      : []),
    ...(isAdmin
      ? [{
          icon: 'delete',
          label: t('common.actions.delete'),
          onClick: () => onDelete(entity),
          danger: true,
        }]
      : []),
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid={`${kind}-actions.btn.menu`}
        onClick={() => setOpen((prev) => !prev)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}
