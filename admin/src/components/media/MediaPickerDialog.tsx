import { useState, useCallback } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useQuery } from '@tanstack/react-query';
import { getMedia } from '@/services/media';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';
import MediaPickerGallery from './MediaPickerGallery';
import MediaPickerUploadPanel from './MediaPickerUploadPanel';
import { useMediaPickerUpload } from './useMediaPickerUpload';

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mediaId: string | null) => void;
  siteId: string;
  currentValue?: string | null;
}

export default function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  siteId,
  currentValue,
}: MediaPickerDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Auto-select the uploaded image and switch back to the gallery
  const handleUploaded = useCallback((mediaId: string) => {
    setSelected(mediaId);
    setActiveTab(0);
  }, []);

  const upload = useMediaPickerUpload(siteId, handleUploaded);

  const { data: mediaData, isLoading } = useQuery({
    queryKey: queryKeys.mediaPicker(siteId),
    queryFn: () => getMedia(siteId, { mime_category: 'image', page_size: 50 }),
    enabled: open && !!siteId,
  });

  const handleSelect = () => {
    onSelect(selected);
    handleClose();
  };

  const handleClear = () => {
    onSelect(null);
    handleClose();
  };

  const handleClose = () => {
    setSelected(null);
    setSearch('');
    setActiveTab(0);
    upload.clearUploadError();
    onClose();
  };

  // Initialize selection from current value when dialog opens
  const effectiveSelected = selected ?? (currentValue || null);

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      icon="image"
      title={t('media.picker.title')}
      maxWidth="md"
      data-testid="media-picker.dialog"
      actions={
        <>
          {currentValue && (
            <M3Button variant="outlined" size="sm" danger onClick={handleClear}>
              {t('media.picker.clear')}
            </M3Button>
          )}
          <Box sx={{ flex: 1 }} />
          <M3Button variant="ghost" size="sm" onClick={handleClose} data-testid="media-picker.btn.cancel">
            {t('common.actions.cancel')}
          </M3Button>
          <M3Button
            variant="filled"
            size="sm"
            onClick={handleSelect}
            disabled={!effectiveSelected}
            data-testid="media-picker.btn.submit"
          >
            {t('media.picker.select')}
          </M3Button>
        </>
      }
    >
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            setActiveTab(v);
            upload.clearUploadError();
          }}
          sx={{ mb: 1 }}
          data-testid="media-picker.tabs"
        >
          <Tab label={t('editor.mediaPicker.tabs.gallery')} data-testid="media-picker.tab.gallery" />
          <Tab label={t('editor.mediaPicker.tabs.upload')} data-testid="media-picker.tab.upload" />
        </Tabs>

        {activeTab === 0 && (
          <MediaPickerGallery
            search={search}
            onSearchChange={setSearch}
            isLoading={isLoading}
            media={mediaData?.data}
            selectedId={effectiveSelected}
            onSelect={setSelected}
          />
        )}

        {activeTab === 1 && (
          <MediaPickerUploadPanel
            dragOver={upload.dragOver}
            onDragOverChange={upload.setDragOver}
            uploading={upload.uploading}
            uploadError={upload.uploadError}
            onFile={upload.uploadFile}
          />
        )}
    </FormDialog>
  );
}
