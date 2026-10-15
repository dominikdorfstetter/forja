import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { uploadFavicon } from '@/services/sites';
import { queryKeys } from '@/lib/queryKeys';
import { loadMediaAsImageFile, type MediaImageImport } from './faviconMediaImport';

const DEFAULT_MAX_FILE_SIZE = 52_428_800;

type ProblemDetailError = { response?: { data?: { detail?: string; title?: string } } };

function errorDetail(error: unknown): string | undefined {
  const data = (error as ProblemDetailError)?.response?.data;
  return data?.detail ?? data?.title;
}

/**
 * Favicon source-image flow: size check, square images upload straight away,
 * non-square ones go through the cropper first. Also imports from the media
 * library.
 */
export function useFaviconUpload(siteId: string, maxFileSize: number | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const { mutate: upload, isPending: uploading } = useMutation({
    mutationFn: (file: File) => uploadFavicon(siteId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favicon(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.site(siteId) });
      enqueueSnackbar(t('settings.favicon.uploadSuccess'), { variant: 'success' });
    },
    onError: (error: unknown) => {
      const detail = errorDetail(error);
      enqueueSnackbar(
        detail ? `${t('settings.favicon.uploadFailed')}: ${detail}` : t('settings.favicon.uploadFailed'),
        { variant: 'error' },
      );
    },
  });

  const handleFileSelected = useCallback(
    (file: File) => {
      const maxBytes = maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
      if (file.size > maxBytes) {
        const maxMB = Math.round(maxBytes / 1_048_576);
        enqueueSnackbar(
          t('settings.favicon.fileTooLarge', { maxMB }),
          { variant: 'error' },
        );
        return;
      }
      const img = new Image();
      // react-doctor-disable-next-line no-create-object-url-without-revoke -- revoked on every path: square image (onload), decode error (onerror), crop complete and crop cancel (handleCropComplete / handleCropCancel)
      const url = URL.createObjectURL(file);
      img.onload = () => {
        if (img.width !== img.height) {
          setCropImageSrc(url);
          setOriginalFile(file);
        } else {
          URL.revokeObjectURL(url);
          upload(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        enqueueSnackbar(
          t('settings.favicon.invalidImage', 'Selected file is not a valid image (PNG, JPEG, GIF, or WebP).'),
          { variant: 'error' },
        );
      };
      img.src = url;
    },
    [upload, enqueueSnackbar, t, maxFileSize],
  );

  const handleCropComplete = useCallback(
    (blob: Blob) => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      const file = new File([blob], originalFile?.name ?? 'favicon.png', { type: 'image/png' });
      upload(file);
      setOriginalFile(null);
    },
    [cropImageSrc, originalFile, upload],
  );

  const handleCropCancel = useCallback(() => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    setOriginalFile(null);
  }, [cropImageSrc]);

  const importFailureMessage = useCallback((result: Exclude<MediaImageImport, { ok: true }>) => {
    switch (result.reason) {
      case 'noPublicUrl':
        return t(
          'settings.favicon.mediaNoPublicUrl',
          'Selected media has no public URL — choose a different file.',
        );
      case 'fetchFailed':
        return t('settings.favicon.mediaFetchFailed', 'Failed to fetch selected media ({{status}}).', {
          status: result.status,
        });
      case 'notImage':
        return t('settings.favicon.invalidImage', 'Selected file is not a valid image (PNG, JPEG, GIF, or WebP).');
    }
  }, [t]);

  const handleMediaSelected = useCallback(
    async (mediaId: string) => {
      try {
        const result = await loadMediaAsImageFile(mediaId);
        if (result.ok) {
          handleFileSelected(result.file);
        } else {
          enqueueSnackbar(importFailureMessage(result), { variant: 'error' });
        }
      } catch {
        enqueueSnackbar(t('settings.favicon.uploadFailed'), { variant: 'error' });
      }
    },
    [handleFileSelected, importFailureMessage, enqueueSnackbar, t],
  );

  return {
    uploading,
    cropImageSrc,
    handleFileSelected,
    handleCropComplete,
    handleCropCancel,
    handleMediaSelected,
  };
}
