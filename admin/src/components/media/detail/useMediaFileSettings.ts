import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateMedia } from '@/services/media';
import type { MediaListItem } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Folder assignment of a media file, saved immediately on change. Seeded from
 * the file on mount — the detail dialog's content mounts fresh on every open.
 */
export function useMediaFolderSelection(media: MediaListItem, siteId: string) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedFolderId, setSelectedFolderId] = useState(() => media.folder_id || '');

  const { mutate: updateFolder } = useMutation({
    mutationFn: (folderId: string | null) =>
      updateMedia(media.id, { folder_id: folderId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media(siteId) });
      enqueueSnackbar('Folder updated', { variant: 'success' });
    },
  });

  const handleFolderChange = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
    updateFolder(folderId || null);
  }, [updateFolder]);

  return { selectedFolderId, handleFolderChange };
}

/** Saves the focal point picked on the image preview. */
export function useMediaFocalPoint(mediaId: string | undefined, siteId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { mutate, isPending } = useMutation({
    mutationFn: ({ focalX, focalY }: { focalX: number; focalY: number }) =>
      updateMedia(mediaId!, { focal_x: focalX, focal_y: focalY }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media(siteId) });
      enqueueSnackbar(t('forms.mediaDetail.focalPoint.saved'), { variant: 'success' });
    },
  });

  const saveFocalPoint = useCallback(
    (x: number, y: number) => mutate({ focalX: x, focalY: y }),
    [mutate],
  );

  return { saveFocalPoint, saving: isPending };
}
