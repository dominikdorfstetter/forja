import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from './useErrorSnackbar';

export function useFederationMutations(siteId: string) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const invalidateFollowers = () => queryClient.invalidateQueries({ queryKey: ['federation-followers'] });
  const invalidateActivities = () => queryClient.invalidateQueries({ queryKey: ['federation-activities'] });
  const invalidateComments = () => queryClient.invalidateQueries({ queryKey: ['federation-comments'] });
  const invalidateBlockedInstances = () => queryClient.invalidateQueries({ queryKey: ['federation-blocked-instances'] });
  const invalidateBlockedActors = () => queryClient.invalidateQueries({ queryKey: ['federation-blocked-actors'] });
  const invalidateSettings = () => queryClient.invalidateQueries({ queryKey: ['federation-settings'] });
  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['federation-stats'] });

  const removeFollower = useMutation({
    mutationFn: (followerId: string) => apiService.removeFederationFollower(siteId, followerId),
    onSuccess: () => { showSuccess('Follower removed'); invalidateFollowers(); invalidateStats(); },
    onError: showError,
  });

  const retryActivity = useMutation({
    mutationFn: (activityId: string) => apiService.retryFederationActivity(siteId, activityId),
    onSuccess: () => { showSuccess('Activity retry queued'); invalidateActivities(); },
    onError: showError,
  });

  const approveComment = useMutation({
    mutationFn: (commentId: string) => apiService.approveFederationComment(siteId, commentId),
    onSuccess: () => { showSuccess('Comment approved'); invalidateComments(); invalidateStats(); },
    onError: showError,
  });

  const rejectComment = useMutation({
    mutationFn: (commentId: string) => apiService.rejectFederationComment(siteId, commentId),
    onSuccess: () => { showSuccess('Comment rejected'); invalidateComments(); invalidateStats(); },
    onError: showError,
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => apiService.deleteFederationComment(siteId, commentId),
    onSuccess: () => { showSuccess('Comment deleted'); invalidateComments(); invalidateStats(); },
    onError: showError,
  });

  const blockInstanceMutation = useMutation({
    mutationFn: (data: { instanceDomain: string; reason?: string }) => apiService.blockInstance(siteId, data),
    onSuccess: () => { showSuccess('Instance blocked'); invalidateBlockedInstances(); },
    onError: showError,
  });

  const unblockInstanceMutation = useMutation({
    mutationFn: (blockId: string) => apiService.unblockInstance(siteId, blockId),
    onSuccess: () => { showSuccess('Instance unblocked'); invalidateBlockedInstances(); },
    onError: showError,
  });

  const blockActorMutation = useMutation({
    mutationFn: (data: { actorUri: string; reason?: string }) => apiService.blockActor(siteId, data),
    onSuccess: () => { showSuccess('Actor blocked'); invalidateBlockedActors(); },
    onError: showError,
  });

  const unblockActorMutation = useMutation({
    mutationFn: (blockId: string) => apiService.unblockActor(siteId, blockId),
    onSuccess: () => { showSuccess('Actor unblocked'); invalidateBlockedActors(); },
    onError: showError,
  });

  const enableFederation = useMutation({
    mutationFn: () => apiService.enableFederation(siteId),
    onSuccess: () => { showSuccess('Federation enabled'); invalidateSettings(); invalidateStats(); },
    onError: showError,
  });

  const disableFederation = useMutation({
    mutationFn: () => apiService.disableFederation(siteId),
    onSuccess: () => { showSuccess('Federation disabled'); invalidateSettings(); },
    onError: showError,
  });

  const updateSettings = useMutation({
    mutationFn: (data: Parameters<typeof apiService.updateFederationSettings>[1]) => apiService.updateFederationSettings(siteId, data),
    onSuccess: () => { showSuccess('Settings updated'); invalidateSettings(); },
    onError: showError,
  });

  const rotateKeysMutation = useMutation({
    mutationFn: () => apiService.rotateKeys(siteId),
    onSuccess: () => { showSuccess('Keys rotated successfully'); },
    onError: showError,
  });

  return {
    removeFollower,
    retryActivity,
    approveComment,
    rejectComment,
    deleteComment,
    blockInstanceMutation,
    unblockInstanceMutation,
    blockActorMutation,
    unblockActorMutation,
    enableFederation,
    disableFederation,
    updateSettings,
    rotateKeysMutation,
  };
}
