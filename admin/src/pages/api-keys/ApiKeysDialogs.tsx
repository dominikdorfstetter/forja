import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiKeyPermission } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CreateApiKeyDialog from '@/components/api-keys/CreateApiKeyDialog';
import EditApiKeyDialog from '@/components/api-keys/EditApiKeyDialog';
import BlockKeyDialog from '@/components/api-keys/BlockKeyDialog';
import ApiKeyUsageDialog from '@/components/api-keys/ApiKeyUsageDialog';
import type { UIAction, UIState } from './apiKeysUiState';
import type { ApiKeysMutations } from './useApiKeysMutations';

interface ApiKeysDialogsProps {
  ui: UIState;
  dispatch: Dispatch<UIAction>;
  siteId: string;
  maxPermission: ApiKeyPermission;
  mutations: ApiKeysMutations;
}

/** Create / edit / block / revoke / delete / usage dialogs driven by the page's UI state. */
export default function ApiKeysDialogs({ ui, dispatch, siteId, maxPermission, mutations }: ApiKeysDialogsProps) {
  const { t } = useTranslation();
  const { blockMutation, revokeMutation, deleteMutation, createKey, updateKey } = mutations;

  return (
    <>
      <CreateApiKeyDialog
        open={ui.createOpen}
        siteId={siteId}
        maxPermission={maxPermission}
        onSubmit={createKey}
        onClose={() => dispatch({ type: 'closeCreate' })}
      />

      <EditApiKeyDialog
        open={!!ui.editingKey}
        apiKey={ui.editingKey}
        onSubmit={updateKey}
        onClose={() => dispatch({ type: 'closeEdit' })}
      />

      <BlockKeyDialog
        open={!!ui.blockingKey}
        keyName={ui.blockingKey?.name || ''}
        onConfirm={(reason) =>
          ui.blockingKey && blockMutation.mutate({ id: ui.blockingKey.id, reason })
        }
        onCancel={() => dispatch({ type: 'closeBlock' })}
        loading={blockMutation.isPending}
      />

      <ConfirmDialog
        open={!!ui.revokingKey}
        title={t('apiKeys.revokeDialog.title')}
        message={t('apiKeys.revokeDialog.message', { name: ui.revokingKey?.name })}
        confirmLabel={t('apiKeys.actionsMenu.revoke')}
        confirmColor="warning"
        onConfirm={() => ui.revokingKey && revokeMutation.mutate(ui.revokingKey.id)}
        onCancel={() => dispatch({ type: 'closeRevoke' })}
        loading={revokeMutation.isPending}
        confirmationText={t('apiKeys.revokeDialog.confirmWord')}
      />

      <ConfirmDialog
        open={!!ui.deletingKey}
        title={t('apiKeys.deleteDialog.title')}
        message={t('apiKeys.deleteDialog.message', { name: ui.deletingKey?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => ui.deletingKey && deleteMutation.mutate(ui.deletingKey.id)}
        onCancel={() => dispatch({ type: 'closeDelete' })}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />

      <ApiKeyUsageDialog
        open={!!ui.usageKey}
        keyId={ui.usageKey?.id || null}
        keyName={ui.usageKey?.name || ''}
        onClose={() => dispatch({ type: 'closeUsage' })}
      />
    </>
  );
}
