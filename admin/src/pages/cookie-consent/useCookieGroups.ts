import { useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createLegalGroup, deleteLegalGroup, getLegalGroups, updateLegalGroup } from '@/services/legal';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CreateLegalGroupRequest, UpdateLegalGroupRequest } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  cookieDialogReducer,
  initialDialogState,
  swapGroups,
  type MoveDirection,
} from './cookieGroupState';

/**
 * Cookie-consent groups of one document: the list query, CRUD mutations,
 * up/down reordering, and the add/edit/delete dialog state they drive.
 */
export function useCookieGroups(documentId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [dialogState, dialogDispatch] = useReducer(cookieDialogReducer, initialDialogState);

  const invalidateGroups = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.legalGroups(documentId) });

  const { data: groups, isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: queryKeys.legalGroups(documentId),
    queryFn: () => getLegalGroups(documentId),
    enabled: !!documentId,
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: CreateLegalGroupRequest) => createLegalGroup(documentId, data),
    onSuccess: () => {
      invalidateGroups();
      dialogDispatch({ type: 'CLOSE_GROUP_FORM' });
      showSuccess(t('legalDetail.groups.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateLegalGroupRequest }) =>
      updateLegalGroup(groupId, data),
    onSuccess: () => {
      invalidateGroups();
      dialogDispatch({ type: 'SET_EDITING_GROUP', payload: null });
      showSuccess(t('legalDetail.groups.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteLegalGroup(groupId),
    onSuccess: () => {
      invalidateGroups();
      dialogDispatch({ type: 'SET_DELETING_GROUP', payload: null });
      showSuccess(t('legalDetail.groups.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const moveGroup = async (currentIndex: number, direction: MoveDirection) => {
    const reordered = groups ? swapGroups(groups, currentIndex, direction) : null;
    if (!reordered) return;
    // Assign sequential display_order to the swapped list
    await Promise.all(
      reordered.map((g, i) => updateLegalGroup(g.id, { display_order: i }))
    );
    invalidateGroups();
  };

  return {
    groups,
    groupsLoading,
    groupsError,
    dialogState,
    dialogDispatch,
    createGroupMutation,
    updateGroupMutation,
    deleteGroupMutation,
    moveGroup,
  };
}
