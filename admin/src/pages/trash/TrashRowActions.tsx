import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActionBtn, ActionMenu, type ActionMenuItem } from '@/components/shared/listPageV2';
import type { TrashItem } from './trashItem';

interface TrashRowActionsProps {
  item: TrashItem;
  isAdmin: boolean;
  canWrite: boolean;
  busy: boolean;
  onRestore: (i: TrashItem) => void;
  onDeleteOne: (i: TrashItem) => void;
}

export default function TrashRowActions({
  item,
  isAdmin,
  canWrite,
  busy,
  onRestore,
  onDeleteOne,
}: TrashRowActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Restore re-creates content on the site — a write, gated by canWrite (#6).
  // Permanent delete stays admin-only.
  const items: ActionMenuItem[] = [
    ...(canWrite
      ? [
          {
            icon: 'restore',
            label: t('trash.restore'),
            disabled: busy,
            onClick: () => onRestore(item),
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            icon: 'delete_forever',
            label: t('trash.permanentDelete'),
            danger: true,
            onClick: () => onDeleteOne(item),
          },
        ]
      : []),
  ];

  // Nothing actionable for read-only viewers — don't render an empty menu.
  if (items.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid={`trash.actions.${item.id}`}
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}
