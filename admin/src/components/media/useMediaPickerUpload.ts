import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { uploadMediaFile } from '@/services/media';
import { queryKeys } from '@/lib/queryKeys';
import { ACCEPTED_IMAGE_TYPES, checkMediaFile, type MediaFileIssue } from './mediaFileValidation';

const ISSUE_MESSAGE_KEYS: Record<MediaFileIssue, string> = {
  tooLarge: 'editor.mediaPicker.upload.tooLarge',
  invalidType: 'editor.mediaPicker.upload.invalidType',
};

/**
 * Upload-tab state for the media picker: validates the image, uploads it to
 * the site, refreshes the picker gallery and hands the new media id back.
 */
export function useMediaPickerUpload(siteId: string, onUploaded: (mediaId: string) => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const issue = checkMediaFile(file, ACCEPTED_IMAGE_TYPES);
      if (issue) {
        setUploadError(t(ISSUE_MESSAGE_KEYS[issue]));
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const media = await uploadMediaFile(file, [siteId]);
        // Invalidate gallery query so the new image appears
        await queryClient.invalidateQueries({ queryKey: queryKeys.mediaPicker(siteId) });
        onUploaded(media.id);
      } catch {
        setUploadError(t('media.upload.invalidType'));
      } finally {
        setUploading(false);
      }
    },
    [siteId, queryClient, onUploaded, t],
  );

  const clearUploadError = useCallback(() => setUploadError(null), []);

  return { dragOver, setDragOver, uploading, uploadError, clearUploadError, uploadFile };
}
