import type { Dispatch } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { blockApiKey, createApiKey, deleteApiKey, revokeApiKey, unblockApiKey, updateApiKey } from '@/services/apiKeys';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CreateApiKeyRequest, UpdateApiKeyRequest } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import type { UIAction } from './apiKeysUiState';

/** API-key mutations for the list page; each success refreshes the list and closes its dialog. */
export function useApiKeysMutations(dispatch: Dispatch<UIAction>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const invalidateKeys = () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });

  const onSuccessFor = (successKey: string, close?: UIAction) => () => {
    invalidateKeys();
    if (close) dispatch(close);
    showSuccess(t(successKey));
  };
  const onError = (error: unknown) => showError(error);

  const blockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => blockApiKey(id, reason),
    onSuccess: onSuccessFor('apiKeys.messages.blocked', { type: 'closeBlock' }),
    onError,
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => unblockApiKey(id),
    onSuccess: onSuccessFor('apiKeys.messages.unblocked'),
    onError,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: onSuccessFor('apiKeys.messages.revoked', { type: 'closeRevoke' }),
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: onSuccessFor('apiKeys.messages.deleted', { type: 'closeDelete' }),
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) => updateApiKey(id, data),
    onSuccess: onSuccessFor('apiKeys.messages.updated', { type: 'closeEdit' }),
    onError,
  });

  const createKey = async (data: CreateApiKeyRequest) => {
    const result = await createApiKey(data);
    invalidateKeys();
    return result;
  };

  const updateKey = async (id: string, data: UpdateApiKeyRequest) => {
    await updateMutation.mutateAsync({ id, data });
  };

  return { blockMutation, unblockMutation, revokeMutation, deleteMutation, createKey, updateKey };
}

export type ApiKeysMutations = ReturnType<typeof useApiKeysMutations>;
