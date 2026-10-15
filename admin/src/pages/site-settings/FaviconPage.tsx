import { useState, useCallback } from 'react';
import { Box, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { downloadFaviconPackage, getFavicon, getSite, getSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import ImageCropper from '@/components/shared/ImageCropper';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useSiteContext } from '@/store/SiteContext';
import { SectionHead } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';
import { useFaviconColors } from './favicon/useFaviconColors';
import { useFaviconUpload } from './favicon/useFaviconUpload';
import FaviconUploadCard from './favicon/FaviconUploadCard';
import FaviconColorsCard from './favicon/FaviconColorsCard';
import { FaviconSnippetCard, FaviconVariantsCard } from './favicon/FaviconOutputCards';

export default function FaviconPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: site } = useQuery({
    queryKey: queryKeys.site(selectedSiteId),
    queryFn: () => getSite(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: favicon, isLoading: isFaviconLoading } = useQuery({
    queryKey: queryKeys.favicon(selectedSiteId),
    queryFn: () => getFavicon(selectedSiteId),
    enabled: !!selectedSiteId && !!site?.favicon_url,
    retry: false,
  });

  const colors = useFaviconColors(selectedSiteId, settings);
  const upload = useFaviconUpload(selectedSiteId, settings?.max_media_file_size);

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

  const { handleMediaSelected } = upload;
  const handleMediaSelect = useCallback(
    (mediaId: string | null) => {
      setMediaPickerOpen(false);
      if (mediaId) handleMediaSelected(mediaId);
    },
    [handleMediaSelected],
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
        {upload.cropImageSrc && (
          <ImageCropper
            imageSrc={upload.cropImageSrc}
            aspectRatio={1}
            onCropComplete={upload.handleCropComplete}
            onCancel={upload.handleCropCancel}
          />
        )}

        <FaviconUploadCard
          uploading={upload.uploading}
          onFileSelected={upload.handleFileSelected}
          onChooseFromMedia={() => setMediaPickerOpen(true)}
        />

        {favicon && !isFaviconLoading && (
          <FaviconVariantsCard variants={favicon.variants} onDownload={handleDownload} />
        )}

        <FaviconColorsCard
          themeColor={colors.themeColor}
          bgColor={colors.bgColor}
          onThemeColorChange={colors.changeThemeColor}
          onBgColorChange={colors.changeBgColor}
        />

        {favicon && <FaviconSnippetCard snippet={favicon.head_snippet} onCopy={copySnippet} />}

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
