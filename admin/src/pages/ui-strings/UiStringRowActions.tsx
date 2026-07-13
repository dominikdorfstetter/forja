import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionMenu, RowActionBtn, type ActionMenuItem } from '@/components/shared/listPageV2';
import type { UiStringResponse } from '@/types/api';

/** Trailing-column edit/delete menu for one UI string row. */
export default function UiStringRowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: UiStringResponse;
  onEdit: (row: UiStringResponse) => void;
  onDelete: (row: UiStringResponse) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: ActionMenuItem[] = [
    { icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(row) },
    {
      icon: 'delete',
      label: t('common.actions.delete'),
      danger: true,
      onClick: () => onDelete(row),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="ui-strings.row-actions"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}
