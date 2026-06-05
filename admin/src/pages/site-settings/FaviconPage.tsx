import { useState, useCallback } from 'react';
import {
  Box, TextField, Alert, IconButton, Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getMediaById } from '@/services/media';
import { downloadFaviconPackage, getFavicon, getSite, getSiteSettings, updateSiteSettings, uploadFavicon } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import ImageCropper from '@/components/shared/ImageCropper';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useSiteContext } from '@/store/SiteContext';
import type { FaviconVariant } from '@/types/api';
import {
  SectionHead,
  CardGroup,
  SettingsCard,
  Field,
  M3Button,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';

export default function FaviconPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [themeColor, setThemeColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [colorsDirty, setColorsDirty] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: site } = useQuery({
    queryKey: ['site', selectedSiteId],
    queryFn: () => getSite(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  // Sync colors from settings only while clean — otherwise the user's
  // pending edits would be clobbered by an incidental refetch.
  if (settings && !colorsDirty) {
    if (themeColor !== (settings.theme_color ?? '#ffffff')) {
      setThemeColor(settings.theme_color ?? '#ffffff');
    }
    if (bgColor !== (settings.background_color ?? '#ffffff')) {
      setBgColor(settings.background_color ?? '#ffffff');
    }
  }

  const { data: favicon, isLoading: isFaviconLoading } = useQuery({
    queryKey: ['favicon', selectedSiteId],
    queryFn: () => getFavicon(selectedSiteId),
    enabled: !!selectedSiteId && !!site?.favicon_url,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFavicon(selectedSiteId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favicon', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['site', selectedSiteId] });
      enqueueSnackbar(t('settings.favicon.uploadSuccess'), { variant: 'success' });
    },
    onError: (error: unknown) => {
      const detail =
        (error as { response?: { data?: { detail?: string; title?: string } } })?.response?.data
          ?.detail ??
        (error as { response?: { data?: { detail?: string; title?: string } } })?.response?.data
          ?.title;
      enqueueSnackbar(
        detail ? `${t('settings.favicon.uploadFailed')}: ${detail}` : t('settings.favicon.uploadFailed'),
        { variant: 'error' },
      );
    },
  });

  const colorMutation = useMutation({
    mutationFn: (data: { theme_color: string; background_color: string }) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['favicon', selectedSiteId] });
      setColorsDirty(false);
      enqueueSnackbar(t('settings.favicon.colorsSaved'), { variant: 'success' });
    },
  });

  const handleSaveColors = useCallback(() => {
    colorMutation.mutate({ theme_color: themeColor, background_color: bgColor });
  }, [colorMutation, themeColor, bgColor]);

  const discardColorChanges = useCallback(() => {
    setThemeColor(settings?.theme_color ?? '#ffffff');
    setBgColor(settings?.background_color ?? '#ffffff');
    setColorsDirty(false);
  }, [settings]);

  useFormSaveBar({
    id: 'site-settings.favicon.colors',
    isDirty: colorsDirty,
    saving: colorMutation.isPending,
    onSave: handleSaveColors,
    onDiscard: discardColorChanges,
    saveTestId: 'site-settings.favicon.save-colors',
    discardTestId: 'site-settings.favicon.discard-colors',
  });

  const handleFileSelected = useCallback(
    (file: File) => {
      const maxBytes = settings?.max_media_file_size ?? 52_428_800;
      if (file.size > maxBytes) {
        const maxMB = Math.round(maxBytes / 1_048_576);
        enqueueSnackbar(
          t('settings.favicon.fileTooLarge', { maxMB }),
          { variant: 'error' },
        );
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        if (img.width !== img.height) {
          setCropImageSrc(url);
          setOriginalFile(file);
        } else {
          URL.revokeObjectURL(url);
          uploadMutation.mutate(file);
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
    [uploadMutation, enqueueSnackbar, t, settings],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected],
  );

  const handleCropComplete = useCallback(
    (blob: Blob) => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      const file = new File([blob], originalFile?.name ?? 'favicon.png', { type: 'image/png' });
      uploadMutation.mutate(file);
      setOriginalFile(null);
    },
    [cropImageSrc, originalFile, uploadMutation],
  );

  const handleCropCancel = useCallback(() => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    setOriginalFile(null);
  }, [cropImageSrc]);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await downloadFaviconPackage(selectedSiteId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'favicon-package.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      enqueueSnackbar(t('settings.favicon.downloadFailed'), { variant: 'error' });
    }
  }, [selectedSiteId, enqueueSnackbar, t]);

  const copySnippet = useCallback(() => {
    if (favicon?.head_snippet) {
      navigator.clipboard.writeText(favicon.head_snippet);
      enqueueSnackbar(t('settings.favicon.snippetCopied'), { variant: 'success' });
    }
  }, [favicon, enqueueSnackbar, t]);

  const handleMediaSelect = useCallback(
    async (mediaId: string | null) => {
      setMediaPickerOpen(false);
      if (!mediaId) return;
      try {
        const media = await getMediaById(mediaId);
        if (!media.public_url) {
          enqueueSnackbar(
            t(
              'settings.favicon.mediaNoPublicUrl',
              'Selected media has no public URL — choose a different file.',
            ),
            { variant: 'error' },
          );
          return;
        }
        const response = await fetch(media.public_url);
        if (!response.ok) {
          enqueueSnackbar(
            t('settings.favicon.mediaFetchFailed', 'Failed to fetch selected media ({{status}}).', {
              status: response.status,
            }),
            { variant: 'error' },
          );
          return;
        }
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
          enqueueSnackbar(
            t('settings.favicon.invalidImage', 'Selected file is not a valid image (PNG, JPEG, GIF, or WebP).'),
            { variant: 'error' },
          );
          return;
        }
        const extension = media.original_filename.split('.').pop() ?? 'png';
        const file = new File([blob], media.original_filename, {
          type: blob.type || `image/${extension}`,
        });
        handleFileSelected(file);
      } catch {
        enqueueSnackbar(t('settings.favicon.uploadFailed'), { variant: 'error' });
      }
    },
    [handleFileSelected, enqueueSnackbar, t],
  );

  if (isSettingsLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <Box data-testid="site-settings.favicon.page">
      <SectionHead
        icon="palette"
        title={t('siteSettings.branding.title', 'Branding')}
        subtitle={t(
          'siteSettings.branding.subtitle',
          'Site icon, favicons, and theme colors used by browsers and PWAs.',
        )}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {cropImageSrc && (
          <ImageCropper
            imageSrc={cropImageSrc}
            aspectRatio={1}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}

        <CardGroup label={t('settings.favicon.title')}>
          <SettingsCard>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              {t('settings.favicon.description')}
            </div>

            <Box
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              sx={{
                borderRadius: 3,
                border: '2px dashed var(--outline-variant)',
                p: 4,
                textAlign: 'center',
                transition: 'background 150ms, border-color 150ms',
                '&:hover': {
                  borderColor: 'var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 6%, transparent)',
                },
              }}
              data-testid="site-settings.favicon.dropzone"
            >
              <CloudUploadIcon sx={{ fontSize: 42, color: 'var(--on-surface-variant)', mb: 1 }} />
              <Box sx={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)', mb: 0.5 }}>
                {t('settings.favicon.dropHere')}
              </Box>
              <Box sx={{ fontSize: 12.5, color: 'var(--on-surface-variant)', mb: 2 }}>
                {t('settings.favicon.recommended')}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Box
                  component="label"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    height: 40,
                    px: 2.5,
                    borderRadius: 999,
                    cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
                    background: 'var(--primary)',
                    color: 'var(--primary-c)',
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    opacity: uploadMutation.isPending ? 0.5 : 1,
                    transition: 'transform 120ms',
                    '&:active': { transform: 'scale(0.97)' },
                  }}
                  data-testid="site-settings.favicon.upload-btn"
                >
                  <CloudUploadIcon sx={{ fontSize: 18 }} />
                  {uploadMutation.isPending
                    ? t('settings.favicon.generating')
                    : t('settings.favicon.selectFile')}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    aria-label={t('settings.favicon.selectFile')}
                    onChange={handleFileChange}
                  />
                </Box>
                <M3Button
                  variant="outlined"
                  size="md"
                  icon="collections"
                  disabled={uploadMutation.isPending}
                  onClick={() => setMediaPickerOpen(true)}
                  data-testid="site-settings.favicon.choose-from-media"
                >
                  {t('settings.favicon.chooseFromMedia')}
                </M3Button>
              </Box>
            </Box>
          </SettingsCard>
        </CardGroup>

        {favicon && !isFaviconLoading && (
          <CardGroup
            label={t('settings.favicon.variants')}
            actions={
              <M3Button
                variant="ghost"
                size="sm"
                icon="download"
                onClick={handleDownload}
                data-testid="site-settings.favicon.download"
              >
                {t('settings.favicon.download')}
              </M3Button>
            }
          >
            <SettingsCard>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 1.5,
                }}
              >
                {favicon.variants.map((v: FaviconVariant) => (
                  <Box
                    key={v.name}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      borderRadius: 2,
                      border: '1px solid var(--outline-variant)',
                      background: 'var(--surface-container-high)',
                    }}
                    data-testid="site-settings.favicon.variant"
                  >
                    <Box
                      component="img"
                      src={v.url}
                      alt={v.name}
                      sx={{
                        width: Math.min(v.width, 64),
                        height: Math.min(v.height, 64),
                        objectFit: 'contain',
                        mb: 1,
                        imageRendering: v.width <= 32 ? 'pixelated' : 'auto',
                      }}
                    />
                    <Box sx={{ fontSize: 12, color: 'var(--on-surface)', fontWeight: 500 }}>
                      {v.name}
                    </Box>
                    <Box sx={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                      {v.width}×{v.height}
                    </Box>
                  </Box>
                ))}
              </Box>
            </SettingsCard>
          </CardGroup>
        )}

        <CardGroup label={t('settings.favicon.colors')}>
          <SettingsCard>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
              <Field
                fieldId="favicon-theme-color"
                label={t('settings.favicon.themeColor')}
              >
                <TextField
                  id="favicon-theme-color"
                  value={themeColor}
                  onChange={(e) => {
                    setThemeColor(e.target.value);
                    setColorsDirty(true);
                  }}
                  size="small"
                  type="color"
                  sx={{ width: 150 }}
                  data-testid="site-settings.favicon.theme-color"
                />
              </Field>
              <Field
                fieldId="favicon-bg-color"
                label={t('settings.favicon.bgColor')}
              >
                <TextField
                  id="favicon-bg-color"
                  value={bgColor}
                  onChange={(e) => {
                    setBgColor(e.target.value);
                    setColorsDirty(true);
                  }}
                  size="small"
                  type="color"
                  sx={{ width: 150 }}
                  data-testid="site-settings.favicon.bg-color"
                />
              </Field>
            </Box>
          </SettingsCard>
        </CardGroup>

        {favicon && (
          <CardGroup
            label={t('settings.favicon.snippet')}
            actions={
              <Tooltip title={t('settings.favicon.copySnippet')}>
                <IconButton
                  onClick={copySnippet}
                  size="small"
                  data-testid="site-settings.favicon.copy-snippet"
                  sx={{ color: 'var(--on-surface-variant)' }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <SettingsCard>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid var(--outline-variant)',
                  background: 'var(--surface-container-high)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
                data-testid="site-settings.favicon.snippet-preview"
              >
                {favicon.head_snippet}
              </Box>
            </SettingsCard>
          </CardGroup>
        )}

        {!favicon && !isFaviconLoading && (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            {t('settings.favicon.noFavicon')}
          </Alert>
        )}

        <MediaPickerDialog
          open={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          onSelect={handleMediaSelect}
          siteId={selectedSiteId}
        />
      </Box>
    </Box>
  );
}
