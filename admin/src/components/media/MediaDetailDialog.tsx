import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Tabs,
  Tab,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import type { MediaListItem, MediaFolder, MediaMetadataResponse, Locale } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';

interface MediaDetailDialogProps {
  open: boolean;
  media: MediaListItem | null;
  folders: MediaFolder[];
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaDetailDialog({ open, media, folders, onClose }: MediaDetailDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Metadata editing state per locale
  const [editingMeta, setEditingMeta] = useState<Record<string, { alt_text: string; caption: string; title: string }>>({});

  const { data: siteLocalesRaw = [] } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = siteLocalesRaw
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));

  const { data: metadata = [] } = useQuery({
    queryKey: ['media-metadata', media?.id],
    queryFn: () => apiService.getMediaMetadata(media!.id),
    enabled: !!media?.id,
  });

  useEffect(() => {
    if (media) {
      setSelectedFolderId(media.folder_id || '');
    }
  }, [media]);

  useEffect(() => {
    const map: Record<string, { alt_text: string; caption: string; title: string }> = {};
    for (const m of metadata) {
      map[m.locale_id] = { alt_text: m.alt_text || '', caption: m.caption || '', title: m.title || '' };
    }
    setEditingMeta(map);
  }, [metadata]);

  const updateFolderMutation = useMutation({
    mutationFn: (folderId: string | null) =>
      apiService.updateMedia(media!.id, { folder_id: folderId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      enqueueSnackbar('Folder updated', { variant: 'success' });
    },
  });

  const createMetaMutation = useMutation({
    mutationFn: (data: { localeId: string; alt_text: string; caption: string; title: string }) =>
      apiService.createMediaMetadata(media!.id, {
        locale_id: data.localeId,
        alt_text: data.alt_text || undefined,
        caption: data.caption || undefined,
        title: data.title || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-metadata', media?.id] });
      enqueueSnackbar('Metadata saved', { variant: 'success' });
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: (data: { id: string; alt_text: string; caption: string; title: string }) =>
      apiService.updateMediaMetadata(data.id, {
        alt_text: data.alt_text || undefined,
        caption: data.caption || undefined,
        title: data.title || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-metadata', media?.id] });
      enqueueSnackbar('Metadata updated', { variant: 'success' });
    },
  });

  const deleteMetaMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMediaMetadata(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-metadata', media?.id] });
      enqueueSnackbar('Metadata removed', { variant: 'success' });
    },
  });

  if (!media) return null;

  const handleSaveMetadata = (localeId: string) => {
    const values = editingMeta[localeId];
    if (!values) return;

    const existing = metadata.find((m: MediaMetadataResponse) => m.locale_id === localeId);
    if (existing) {
      updateMetaMutation.mutate({ id: existing.id, ...values });
    } else {
      createMetaMutation.mutate({ localeId, ...values });
    }
  };

  const handleFolderChange = (folderId: string) => {
    setSelectedFolderId(folderId);
    updateFolderMutation.mutate(folderId || null);
  };

  const handleMetaFieldChange = (localeId: string, field: string, value: string) => {
    setEditingMeta((prev) => ({
      ...prev,
      [localeId]: { ...(prev[localeId] || { alt_text: '', caption: '', title: '' }), [field]: value },
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('forms.mediaDetail.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
          {/* Preview */}
          <Box sx={{ flexShrink: 0, width: 200, textAlign: 'center' }}>
            {media.public_url && media.mime_type.startsWith('image/') ? (
              <Box component="img" src={media.public_url} alt={media.filename} sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 1 }} />
            ) : media.mime_type.startsWith('image/') ? (
              <ImageIcon sx={{ fontSize: 80 }} color="primary" />
            ) : (
              <InsertDriveFileIcon sx={{ fontSize: 80 }} color="action" />
            )}
          </Box>

          {/* File Info */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>{media.original_filename}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Chip label={media.mime_type} size="small" />
              <Chip label={formatFileSize(media.file_size)} size="small" variant="outlined" />
              {media.width && media.height && <Chip label={`${media.width}x${media.height}`} size="small" variant="outlined" />}
            </Stack>
            {media.public_url && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}>
                {media.public_url}
              </Typography>
            )}

            <FormControl fullWidth size="small" sx={{ mt: 2 }}>
              <InputLabel>{t('forms.mediaDetail.fields.folder')}</InputLabel>
              <Select value={selectedFolderId} label={t('forms.mediaDetail.fields.folder')} onChange={(e) => handleFolderChange(e.target.value)}>
                <MenuItem value="">{t('forms.mediaDetail.fields.noFolder')}</MenuItem>
                {folders.map((f) => (
                  <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Metadata Tabs */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Localized Metadata</Typography>
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="scrollable">
            {locales.map((locale: Locale, i: number) => (
              <Tab key={locale.id} label={locale.code.toUpperCase()} value={i} />
            ))}
          </Tabs>
          {locales.map((locale: Locale, i: number) => {
            if (i !== tabIndex) return null;
            const values = editingMeta[locale.id] || { alt_text: '', caption: '', title: '' };
            const existing = metadata.find((m: MediaMetadataResponse) => m.locale_id === locale.id);
            return (
              <Stack key={locale.id} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label={t('forms.mediaDetail.fields.altText')}
                  size="small"
                  fullWidth
                  value={values.alt_text}
                  onChange={(e) => handleMetaFieldChange(locale.id, 'alt_text', e.target.value)}
                />
                <TextField
                  label={t('forms.mediaDetail.fields.caption')}
                  size="small"
                  fullWidth
                  value={values.caption}
                  onChange={(e) => handleMetaFieldChange(locale.id, 'caption', e.target.value)}
                />
                <TextField
                  label={t('forms.mediaDetail.fields.title')}
                  size="small"
                  fullWidth
                  value={values.title}
                  onChange={(e) => handleMetaFieldChange(locale.id, 'title', e.target.value)}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleSaveMetadata(locale.id)}
                    disabled={createMetaMutation.isPending || updateMetaMutation.isPending}
                  >
                    {existing ? t('common.actions.save') : t('common.actions.save')}
                  </Button>
                  {existing && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteMetaMutation.mutate(existing.id)}
                      disabled={deleteMetaMutation.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Stack>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
