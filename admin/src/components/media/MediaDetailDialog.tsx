import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import type { MediaListItem, MediaFolder, SiteSettingsResponse } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import MediaDetailSidebar from './detail/MediaDetailSidebar';
import MediaTagsTab from './detail/MediaTagsTab';
import MediaMetadataTab from './detail/MediaMetadataTab';
import MediaVariantsTab from './detail/MediaVariantsTab';
import MediaUsageTab from './detail/MediaUsageTab';
import { findDefaultLocale } from './detail/mediaDetailModel';
import { useMediaDetailQueries } from './detail/useMediaDetailQueries';
import { useMediaFocalPoint } from './detail/useMediaFileSettings';
import { useMediaTagEditor } from './detail/useMediaTagEditor';
import { useMediaMetadataEditor } from './detail/useMediaMetadataEditor';
import { useMediaMetadataAi } from './detail/useMediaMetadataAi';
import { activeSiteLocalesAsLocales } from '@/utils/siteLocales';

interface MediaDetailDialogProps {
  open: boolean;
  media: MediaListItem | null;
  folders: MediaFolder[];
  onClose: () => void;
}

/** AI image assists need an image the AI provider can fetch and the AI module on. */
function aiImageUrlFor(media: MediaListItem, siteSettings: SiteSettingsResponse | undefined): string | null {
  if (!media.mime_type.startsWith('image/') || !siteSettings?.module_ai_enabled) return null;
  return media.public_url || null;
}

const mainTabsSx = {
  borderBottom: '1px solid var(--outline-variant)',
  minHeight: 40,
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    backgroundColor: 'var(--primary)',
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--on-surface-variant)',
    minHeight: 40,
    px: 2,
    fontVariationSettings: '"wght" 600, "opsz" 13',
    '&.Mui-selected': { color: 'var(--primary)' },
  },
} as const;

export default function MediaDetailDialog({ open, media, folders, onClose }: MediaDetailDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  // Main tab index (Tags=0, Metadata=1, Variants=2, Usage=3)
  const [mainTab, setMainTab] = useState(0);
  // Locale sub-tab index (used inside Metadata tab)
  const [localeTabIndex, setLocaleTabIndex] = useState(0);

  const { siteSettings, siteLocales, metadata, mediaTags, siteTags, mediaDetail, mediaUsage } =
    useMediaDetailQueries(media?.id, selectedSiteId);

  const locales = activeSiteLocalesAsLocales(siteLocales);
  const defaultLocale = findDefaultLocale(locales, siteLocales);

  const focalPoint = useMediaFocalPoint(media?.id, selectedSiteId);
  const tags = useMediaTagEditor(media?.id, selectedSiteId, mediaTags);
  const editor = useMediaMetadataEditor(media?.id, metadata);
  const metadataAi = useMediaMetadataAi({
    siteId: selectedSiteId,
    imageUrl: media?.public_url,
    editingMeta: editor.editingMeta,
    defaultLocale,
    setMetaField: editor.setMetaField,
    setLocaleValues: editor.setLocaleValues,
  });

  if (!media) return null;

  const isImage = media.mime_type.startsWith('image/');
  const aiImageUrl = aiImageUrlFor(media, siteSettings);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="photo_library"
      title={t('forms.mediaDetail.title')}
      maxWidth="lg"
      data-testid="media-detail.dialog"
      actions={
        <M3Button variant="filled" size="sm" onClick={onClose} data-testid="media-detail.btn.close">
          {t('common.actions.close')}
        </M3Button>
      }
    >
        <Box sx={{ display: 'flex', gap: 3, minHeight: 480 }}>
          <MediaDetailSidebar
            media={media}
            isImage={isImage}
            focalSaving={focalPoint.saving}
            onFocalPointSave={focalPoint.saveFocalPoint}
            folders={folders}
            siteId={selectedSiteId}
          />

          {/* RIGHT COLUMN: Tabbed content */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} variant="scrollable" sx={mainTabsSx}>
              <Tab label={t('media.tabs.tags', 'Tags')} />
              <Tab label={t('media.tabs.metadata', 'Metadata')} />
              <Tab label={t('media.tabs.variants', 'Variants')} />
              <Tab label={t('media.tabs.usage', 'Usage')} />
            </Tabs>

            <Box sx={{ flexGrow: 1, overflow: 'auto', pt: 2 }}>
              {mainTab === 0 && (
                <MediaTagsTab
                  ai={aiImageUrl && selectedSiteId ? { siteId: selectedSiteId, imageUrl: aiImageUrl } : null}
                  tags={mediaTags}
                  suggestions={siteTags}
                  saving={tags.saving}
                  onTagsChange={tags.handleTagsChange}
                  onTagsGenerated={tags.mergeTags}
                  onAddSuggestedTag={tags.addTag}
                />
              )}

              {mainTab === 1 && (
                <MediaMetadataTab
                  locales={locales}
                  defaultLocale={defaultLocale}
                  localeTabIndex={localeTabIndex}
                  onLocaleTabChange={setLocaleTabIndex}
                  metadata={metadata}
                  editor={editor}
                  ai={aiImageUrl ? metadataAi : null}
                />
              )}

              {mainTab === 2 && <MediaVariantsTab variants={mediaDetail?.variants} />}

              {mainTab === 3 && <MediaUsageTab references={mediaUsage?.references} />}
            </Box>
          </Box>
        </Box>
    </FormDialog>
  );
}
