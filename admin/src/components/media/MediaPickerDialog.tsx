import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  Typography,
  Box,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMedia, uploadMediaFile } from '@/services/media';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: mediaData, isLoading } = useQuery({
    queryKey: queryKeys.mediaPicker(siteId),
    queryFn: () => getMedia(siteId, { mime_category: 'image', page_size: 50 }),
    enabled: open && !!siteId,
  });

  const filteredMedia = useMemo(() => {
    const list = mediaData?.data ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((m) => m.original_filename.toLowerCase().includes(lower));
  }, [mediaData?.data, search]);

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
    setUploadError(null);
    onClose();
  };

  // --- Upload logic ---

  const validateFile = useCallback(
    (file: File): boolean => {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('editor.mediaPicker.upload.tooLarge'));
        return false;
      }
      if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setUploadError(t('editor.mediaPicker.upload.invalidType'));
        return false;
      }
      return true;
    },
    [t],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return;
      setUploadError(null);
      setUploading(true);
      try {
        const media = await uploadMediaFile(file, [siteId]);
        // Invalidate gallery query so the new image appears
        await queryClient.invalidateQueries({ queryKey: queryKeys.mediaPicker(siteId) });
        // Auto-select the uploaded image and switch to gallery
        setSelected(media.id);
        setActiveTab(0);
      } catch {
        setUploadError(t('media.upload.invalidType'));
      } finally {
        setUploading(false);
      }
    },
    [validateFile, siteId, queryClient, t],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadFile],
  );

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
            setUploadError(null);
          }}
          sx={{ mb: 1 }}
          data-testid="media-picker.tabs"
        >
          <Tab label={t('editor.mediaPicker.tabs.gallery')} data-testid="media-picker.tab.gallery" />
          <Tab label={t('editor.mediaPicker.tabs.upload')} data-testid="media-picker.tab.upload" />
        </Tabs>

        {/* Gallery tab */}
        {activeTab === 0 && (
          <>
            <TextField
              autoFocus
              placeholder={t('media.picker.search')}
              size="small"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }
              }}
            />

            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {!isLoading && filteredMedia.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {t('media.picker.noResults')}
              </Typography>
            )}

            {!isLoading && filteredMedia.length > 0 && (
              <Grid container spacing={1.5}>
                {filteredMedia.map((media) => {
                  const isSelected = effectiveSelected === media.id;
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={media.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          borderWidth: isSelected ? 2 : 1,
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <CardActionArea onClick={() => setSelected(media.id)}>
                          {media.public_url ? (
                            <CardMedia
                              component="img"
                              height={100}
                              image={media.public_url}
                              alt={media.original_filename}
                              sx={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: 100,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'action.hover',
                              }}
                            >
                              <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                            </Box>
                          )}
                          <Box sx={{ px: 1, py: 0.5 }}>
                            <Typography variant="caption" noWrap sx={{ display: "block" }}>
                              {media.original_filename}
                            </Typography>
                            {media.width && media.height && (
                              <Typography variant="caption" color="text.secondary">
                                {media.width} x {media.height}
                              </Typography>
                            )}
                          </Box>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </>
        )}

        {/* Upload tab */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              data-testid="media-picker.upload.dropzone"
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : uploadError ? 'error.main' : 'divider',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
                cursor: uploading ? 'default' : 'pointer',
                bgcolor: dragOver ? 'action.hover' : 'background.default',
                transition: 'all 0.2s ease',
                '&:hover': !uploading ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
              }}
            >
              {uploading ? (
                <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                  <CircularProgress size={48} />
                  <Typography variant="body1" color="text.secondary">
                    {t('editor.mediaPicker.upload.uploading')}
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={1} sx={{ alignItems: "center" }}>
                  <CloudUploadIcon sx={{ fontSize: 48 }} color={dragOver ? 'primary' : 'action'} />
                  <Typography variant="body1" color="text.secondary">
                    {t('editor.mediaPicker.upload.dragDrop')}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    JPEG, PNG, GIF, WebP, AVIF, SVG
                  </Typography>
                </Stack>
              )}
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              style={{ display: 'none' }}
              onChange={handleInputChange}
              aria-label={t('common.actions.selectFile')}
              data-testid="media-picker.upload.input"
            />

            {uploading && <LinearProgress />}

            {uploadError && (
              <Typography variant="body2" color="error" data-testid="media-picker.upload.error">
                {uploadError}
              </Typography>
            )}
          </Stack>
        )}
    </FormDialog>
  );
}
