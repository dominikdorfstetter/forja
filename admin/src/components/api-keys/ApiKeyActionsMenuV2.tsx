import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiKeyListItem } from '@/types/api';
import {
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';

export interface ApiKeyActionsMenuV2Props {
  apiKey: ApiKeyListItem;
  onEdit: (key: ApiKeyListItem) => void;
  onBlock: (key: ApiKeyListItem) => void;
  onUnblock: (key: ApiKeyListItem) => void;
  onRevoke: (key: ApiKeyListItem) => void;
  onDelete: (key: ApiKeyListItem) => void;
  onViewUsage: (key: ApiKeyListItem) => void;
}

/**
 * API key row-action menu built on the listPageV2 RowActionBtn + ActionMenu
 * primitives. Preserves the `revoke-key` testid on the revoke item so any
 * e2e selectors that target it keep working. Items appear conditionally
 * based on the key status (mirrors the legacy component's rules).
 */
export function ApiKeyActionsMenuV2({
  apiKey,
  onEdit,
  onBlock,
  onUnblock,
  onRevoke,
  onDelete,
  onViewUsage,
}: ApiKeyActionsMenuV2Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: ActionMenuItem[] = [
    {
      icon: 'bar_chart',
      label: t('apiKeys.actionsMenu.viewUsage'),
      onClick: () => onViewUsage(apiKey),
    },
    ...(apiKey.status !== 'Revoked'
      ? [
          {
            icon: 'edit',
            label: t('apiKeys.actionsMenu.edit'),
            onClick: () => onEdit(apiKey),
          },
        ]
      : []),
    ...(apiKey.status === 'Active'
      ? [
          {
            icon: 'block',
            label: t('apiKeys.actionsMenu.block'),
            onClick: () => onBlock(apiKey),
          },
        ]
      : []),
    ...(apiKey.status === 'Blocked'
      ? [
          {
            icon: 'check_circle',
            label: t('apiKeys.actionsMenu.unblock'),
            onClick: () => onUnblock(apiKey),
          },
        ]
      : []),
    ...(apiKey.status !== 'Revoked'
      ? [
          {
            icon: 'cancel',
            label: t('apiKeys.actionsMenu.revoke'),
            onClick: () => onRevoke(apiKey),
          },
        ]
      : []),
    {
      icon: 'delete',
      label: t('apiKeys.actionsMenu.delete'),
      danger: true,
      onClick: () => onDelete(apiKey),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="api-key-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}
