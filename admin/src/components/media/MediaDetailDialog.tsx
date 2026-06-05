import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Tabs,
  Tab,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button, M3IconButton } from '@/components/design-system';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { generateAiContent } from '@/services/ai';
import { createMediaMetadata, deleteMediaMetadata, getMediaById, getMediaMetadata, getMediaTags, getMediaUsage, getSiteTags, updateMedia, updateMediaMetadata, updateMediaTags } from '@/services/media';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { MediaListItem, MediaFolder, MediaMetadataResponse, Locale, SiteSettingsResponse, SiteTagItem, AiAction } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import FocalPointPicker from './FocalPointPicker';
import AiVisionActions from './AiVisionActions';
import TagInput from './TagInput';

const EMPTY_METADATA: MediaMetadataResponse[] = [];
const EMPTY_TAGS: string[] = [];

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

  const { data: siteSettings } = useQuery<SiteSettingsResponse>({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Metadata editing state per locale
  const [editingMeta, setEditingMeta] = useState<Record<string, { alt_text: string; caption: string; title: string }>>({});

  // Tags are saved immediately on change — no editing state needed

  // Main tab index (Tags=0, Metadata=1, Variants=2, Usage=3)
  const [mainTab, setMainTab] = useState(0);

  // Locale sub-tab index (used inside Metadata tab)
  const [localeTabIndex, setLocaleTabIndex] = useState(0);

  const { data: siteLocalesRaw = [] } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = siteLocalesRaw
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at, site_count: 0 }));

  const defaultLocale = locales.find((l) =>
    siteLocalesRaw.find((sl) => sl.locale_id === l.id && sl.is_default)
  ) ?? locales[0];

  const { data: metadata = EMPTY_METADATA } = useQuery({
    queryKey: ['media-metadata', media?.id],
    queryFn: () => getMediaMetadata(media!.id),
    enabled: !!media?.id,
  });

  const { data: mediaTags = EMPTY_TAGS } = useQuery<string[]>({
    queryKey: ['media-tags', media?.id],
    queryFn: () => getMediaTags(media!.id).then((r) => r.tags),
    enabled: !!media?.id,
  });

  const { data: siteTagsData } = useQuery({
    queryKey: ['site-tags', selectedSiteId],
    queryFn: () => getSiteTags(selectedSiteId).then((r) => r.tags),
    enabled: !!selectedSiteId,
  });
  const siteTags: SiteTagItem[] = siteTagsData ?? [];

  const { data: mediaDetail } = useQuery({
    queryKey: ['media-detail', media?.id],
    queryFn: () => getMediaById(media!.id),
    enabled: !!media?.id,
  });

  const { data: mediaUsage } = useQuery({
    queryKey: ['media-usage', media?.id],
    queryFn: () => getMediaUsage(media!.id),
    enabled: !!media?.id,
  });

  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    setSelectedFolderId(media?.folder_id || '');
  }
  prevOpenRef.current = open;

  useEffect(() => {
    const map: Record<string, { alt_text: string; caption: string; title: string }> = {};
    for (const m of metadata) {
      map[m.locale_id] = { alt_text: m.alt_text || '', caption: m.caption || '', title: m.title || '' };
    }
    setEditingMeta(map);
  }, [metadata]);

  const updateFolderMutation = useMutation({
    mutationFn: (folderId: string | null) =>
      updateMedia(media!.id, { folder_id: folderId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      enqueueSnackbar('Folder updated', { variant: 'success' });
    },
  });

  const updateFocalPointMutation = useMutation({
    mutationFn: ({ focalX, focalY }: { focalX: number; focalY: number }) =>
      updateMedia(media!.id, { focal_x: focalX, focal_y: focalY }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      enqueueSnackbar(t('forms.mediaDetail.focalPoint.saved'), { variant: 'success' });
    },
  });

  const createMetaMutation = useMutation({
    mutationFn: (data: { localeId: string; alt_text: string; caption: string; title: string }) =>
      createMediaMetadata(media!.id, {
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
      updateMediaMetadata(data.id, {
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
    mutationFn: (id: string) => deleteMediaMetadata(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-metadata', media?.id] });
      enqueueSnackbar('Metadata removed', { variant: 'success' });
    },
  });

  const saveTagsMutation = useMutation({
    mutationFn: (tags: string[]) => updateMediaTags(media!.id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags', media?.id] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['site-tags'] });
    },
  });

  // Auto-save: persist tags immediately on any change
  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      saveTagsMutation.mutate(newTags);
    },
    [saveTagsMutation],
  );

  const handleFocalPointSave = useCallback(
    (x: number, y: number) => {
      updateFocalPointMutation.mutate({ focalX: x, focalY: y });
    },
    [updateFocalPointMutation],
  );

  const handleMetaFieldChange = useCallback((localeId: string, field: string, value: string) => {
    setEditingMeta((prev) => ({
      ...prev,
      [localeId]: { ...(prev[localeId] || { alt_text: '', caption: '', title: '' }), [field]: value },
    }));
  }, []);

  const handleAddSuggestedTag = useCallback((tag: string) => {
    if (!mediaTags.includes(tag)) {
      handleTagsChange([...mediaTags, tag]);
    }
  }, [mediaTags, handleTagsChange]);

  const generateFieldMutation = useMutation({
    mutationFn: ({ action, localeCode }: { action: AiAction; localeCode: string }) =>
      generateAiContent(selectedSiteId, {
        action,
        content: '',
        image_url: media?.public_url ?? undefined,
        target_locale: localeCode,
      }),
  });

  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslateMetadata = useCallback(
    async (targetLocaleId: string, targetLocaleCode: string) => {
      if (!defaultLocale) return;
      const defaultValues = editingMeta[defaultLocale.id];
      if (!defaultValues || (!defaultValues.alt_text && !defaultValues.caption && !defaultValues.title)) {
        enqueueSnackbar(t('media.ai.noSourceContent', 'No content in default locale to translate'), { variant: 'warning' });
        return;
      }

      setIsTranslating(true);
      try {
        // Translate each field independently. Use "subtitle" for alt_text/caption (plain text,
        // up to 150 chars) and "title" for title (plain text, up to 100 chars). These translate
        // field types enforce "no markdown, no formatting" in their prompts.
        const fieldMapping: Array<{ key: 'alt_text' | 'caption' | 'title'; value: string; translateAs: string; responseField: 'subtitle' | 'title' }> = [
          { key: 'alt_text', value: defaultValues.alt_text, translateAs: 'subtitle', responseField: 'subtitle' },
          { key: 'caption', value: defaultValues.caption, translateAs: 'subtitle', responseField: 'subtitle' },
          { key: 'title', value: defaultValues.title, translateAs: 'title', responseField: 'title' },
        ];

        const newValues = { ...(editingMeta[targetLocaleId] || { alt_text: '', caption: '', title: '' }) };

        // Translate fields sequentially to avoid response field collisions
        for (const { key, value, translateAs, responseField } of fieldMapping) {
          if (!value) continue;
          const result = await generateAiContent(selectedSiteId, {
            action: 'translate',
            content: JSON.stringify({ [translateAs]: value }),
            target_locale: targetLocaleCode,
          });
          const translated = result[responseField] ?? '';
          // Strip any residual markdown formatting (**, *, _)
          if (translated) newValues[key] = translated.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/_(.+?)_/g, '$1');
        }

        setEditingMeta((prev) => ({ ...prev, [targetLocaleId]: newValues }));
        enqueueSnackbar(t('media.ai.translated', 'Metadata translated'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('media.ai.generationFailed', 'AI generation failed'), { variant: 'error' });
      } finally {
        setIsTranslating(false);
      }
    },
    [defaultLocale, editingMeta, enqueueSnackbar, t, selectedSiteId],
  );

  const handleGenerateField = useCallback(
    (field: 'alt_text' | 'caption' | 'title', localeId: string, localeCode: string) => {
      const actionMap: Record<'alt_text' | 'caption' | 'title', AiAction> = { alt_text: 'alt_text', caption: 'image_caption', title: 'image_title' };
      generateFieldMutation.mutate(
        { action: actionMap[field], localeCode },
        {
          onSuccess: (result) => {
            let value = '';
            if (field === 'alt_text') value = result.alt_text ?? '';
            else if (field === 'caption') value = result.subtitle ?? '';
            else if (field === 'title') value = result.title ?? '';
            // Strip any residual markdown formatting
            value = value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/_(.+?)_/g, '$1');
            if (value) {
              handleMetaFieldChange(localeId, field, value);
              enqueueSnackbar(t('media.ai.fieldGenerated', 'AI content generated'), { variant: 'success' });
            }
          },
          onError: () => {
            enqueueSnackbar(t('media.ai.generationFailed', 'AI generation failed'), { variant: 'error' });
          },
        },
      );
    },
    [generateFieldMutation, handleMetaFieldChange, enqueueSnackbar, t],
  );

  if (!media) return null;

  const isImage = media.mime_type.startsWith('image/');
  const aiEnabled = isImage && !!siteSettings?.module_ai_enabled && !!media.public_url;

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
          {/* LEFT COLUMN: Preview + File Info */}
          <Box sx={{ width: 280, flexShrink: 0 }}>
            {media.public_url && isImage ? (
              <FocalPointPicker
                key={`${media.focal_x}-${media.focal_y}`}
                src={media.public_url}
                focalX={media.focal_x}
                focalY={media.focal_y}
                saving={updateFocalPointMutation.isPending}
                onSave={handleFocalPointSave}
              />
            ) : isImage ? (
              <ImageIcon sx={{ fontSize: 80 }} color="primary" />
            ) : (
              <InsertDriveFileIcon sx={{ fontSize: 80 }} color="action" />
            )}

            {/* File info — definition list rendered as tokenised rows */}
            <Box
              sx={{
                mt: 2,
                bgcolor: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '16px',
                px: 1.5,
                py: 0.5,
              }}
            >
              {[
                { label: t('forms.mediaDetail.info.filename', 'Filename'), value: media.original_filename, wrap: true },
                { label: t('forms.mediaDetail.info.type', 'Type'), value: media.mime_type },
                { label: t('forms.mediaDetail.info.size', 'Size'), value: formatFileSize(media.file_size) },
                ...(media.width && media.height
                  ? [{ label: t('forms.mediaDetail.info.dimensions', 'Dimensions'), value: `${media.width} × ${media.height}` }]
                  : []),
              ].map((row, i, arr) => (
                <Box
                  key={row.label}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 1.5,
                    py: 1,
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--outline-variant)',
                  }}
                >
                  <Box component="span" sx={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    {row.label}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      fontSize: 13,
                      color: 'var(--on-surface)',
                      textAlign: 'right',
                      wordBreak: row.wrap ? 'break-all' : 'normal',
                      fontVariationSettings: '"wght" 500, "opsz" 13',
                    }}
                  >
                    {row.value}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Folder selector */}
            <FormControl fullWidth size="small" sx={{ mt: 2 }}>
              <InputLabel>{t('forms.mediaDetail.fields.folder')}</InputLabel>
              <Select
                value={folders.some((f) => f.id === selectedFolderId) ? selectedFolderId : ''}
                label={t('forms.mediaDetail.fields.folder')}
                onChange={(e) => handleFolderChange(e.target.value)}
              >
                <MenuItem value="">{t('forms.mediaDetail.fields.noFolder')}</MenuItem>
                {folders.map((f) => (
                  <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Public URL — click to copy */}
            {media.public_url && (
              <Box
                sx={{
                  mt: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  bgcolor: 'var(--surface-container-high)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '10px',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    flexGrow: 1,
                    color: 'var(--on-surface-variant)',
                    wordBreak: 'break-all',
                    fontSize: 11,
                  }}
                >
                  {media.public_url}
                </Typography>
                <M3IconButton
                  name="content_copy"
                  size={28}
                  tooltip={t('media.copyUrl')}
                  onClick={() => {
                    navigator.clipboard.writeText(media.public_url!);
                    enqueueSnackbar(t('media.urlCopied', 'URL copied'), { variant: 'success' });
                  }}
                />
              </Box>
            )}
          </Box>

          {/* RIGHT COLUMN: Tabbed content */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Tabs
              value={mainTab}
              onChange={(_, v) => setMainTab(v)}
              variant="scrollable"
              sx={{
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
              }}
            >
              <Tab label={t('media.tabs.tags', 'Tags')} />
              <Tab label={t('media.tabs.metadata', 'Metadata')} />
              <Tab label={t('media.tabs.variants', 'Variants')} />
              <Tab label={t('media.tabs.usage', 'Usage')} />
            </Tabs>

            <Box sx={{ flexGrow: 1, overflow: 'auto', pt: 2 }}>
              {/* Tab 0: Tags */}
              {mainTab === 0 && (
                <Stack spacing={2}>
                  {aiEnabled && selectedSiteId && (
                    <AiVisionActions
                      siteId={selectedSiteId}
                      imageUrl={media.public_url!}
                      currentTags={mediaTags}
                      onAltTextGenerated={() => {}}
                      onTagsGenerated={(tags) => handleTagsChange([...new Set([...mediaTags, ...tags])])}
                      onAddSuggestedTag={handleAddSuggestedTag}
                    />
                  )}
                  <TagInput
                    tags={mediaTags}
                    onChange={handleTagsChange}
                    suggestions={siteTags}
                    disabled={saveTagsMutation.isPending}
                  />
                </Stack>
              )}

              {/* Tab 1: Metadata (per-locale) */}
              {mainTab === 1 && (
                <Box>
                  <Tabs
                    value={localeTabIndex}
                    onChange={(_, v) => setLocaleTabIndex(v)}
                    variant="scrollable"
                    sx={{
                      minHeight: 36,
                      '& .MuiTabs-indicator': {
                        height: 2,
                        backgroundColor: 'var(--primary)',
                      },
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        minHeight: 36,
                        letterSpacing: 0.5,
                        color: 'var(--on-surface-variant)',
                        '&.Mui-selected': { color: 'var(--primary)' },
                      },
                    }}
                  >
                    {locales.map((locale: Locale, i: number) => (
                      <Tab key={locale.id} label={locale.code.toUpperCase()} value={i} />
                    ))}
                  </Tabs>
                  {locales.map((locale: Locale, i: number) => {
                    if (i !== localeTabIndex) return null;
                    const values = editingMeta[locale.id] || { alt_text: '', caption: '', title: '' };
                    const existing = metadata.find((m: MediaMetadataResponse) => m.locale_id === locale.id);
                    return (
                      <Stack key={locale.id} spacing={2} sx={{ mt: 2 }}>
                        {aiEnabled && defaultLocale && locale.id !== defaultLocale.id && editingMeta[defaultLocale.id] && (
                          <Box sx={{ alignSelf: 'flex-start' }}>
                            <M3Button
                              variant="outlined"
                              size="sm"
                              icon={isTranslating ? undefined : 'translate'}
                              onClick={() => handleTranslateMetadata(locale.id, locale.code)}
                              disabled={isTranslating}
                            >
                              {isTranslating ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                              {t('media.ai.translateFrom', { locale: defaultLocale.code.toUpperCase() })}
                            </M3Button>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                          <TextField
                            label={t('forms.mediaDetail.fields.altText')}
                            size="small"
                            fullWidth
                            value={values.alt_text}
                            onChange={(e) => handleMetaFieldChange(locale.id, 'alt_text', e.target.value)}
                          />
                          {aiEnabled && (
                            <Tooltip title={t('media.ai.generateAltText', 'Generate Alt Text')}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleGenerateField('alt_text', locale.id, locale.code)}
                                disabled={generateFieldMutation.isPending}
                                sx={{ mt: 0.5 }}
                              >
                                {generateFieldMutation.isPending && generateFieldMutation.variables?.action === 'alt_text'
                                  ? <CircularProgress size={18} />
                                  : <AutoFixHighIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                          <TextField
                            label={t('forms.mediaDetail.fields.caption')}
                            size="small"
                            fullWidth
                            value={values.caption}
                            onChange={(e) => handleMetaFieldChange(locale.id, 'caption', e.target.value)}
                          />
                          {aiEnabled && (
                            <Tooltip title={t('media.ai.generateCaption', 'Generate Caption')}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleGenerateField('caption', locale.id, locale.code)}
                                disabled={generateFieldMutation.isPending}
                                sx={{ mt: 0.5 }}
                              >
                                {generateFieldMutation.isPending && generateFieldMutation.variables?.action === 'image_caption'
                                  ? <CircularProgress size={18} />
                                  : <AutoFixHighIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                          <TextField
                            label={t('forms.mediaDetail.fields.title')}
                            size="small"
                            fullWidth
                            value={values.title}
                            onChange={(e) => handleMetaFieldChange(locale.id, 'title', e.target.value)}
                          />
                          {aiEnabled && (
                            <Tooltip title={t('media.ai.generateTitle', 'Generate Title')}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleGenerateField('title', locale.id, locale.code)}
                                disabled={generateFieldMutation.isPending}
                                sx={{ mt: 0.5 }}
                              >
                                {generateFieldMutation.isPending && generateFieldMutation.variables?.action === 'image_title'
                                  ? <CircularProgress size={18} />
                                  : <AutoFixHighIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <M3Button
                            variant="filled"
                            size="sm"
                            icon="save"
                            onClick={() => handleSaveMetadata(locale.id)}
                            disabled={createMetaMutation.isPending || updateMetaMutation.isPending}
                          >
                            {t('common.actions.save')}
                          </M3Button>
                          {existing && (
                            <M3IconButton
                              name="delete"
                              size={36}
                              tooltip={t('common.actions.delete')}
                              disabled={deleteMetaMutation.isPending}
                              onClick={() => deleteMetaMutation.mutate(existing.id)}
                            />
                          )}
                        </Box>
                      </Stack>
                    );
                  })}
                </Box>
              )}

              {/* Tab 2: Variants */}
              {mainTab === 2 && (
                <Box>
                  {mediaDetail?.variants && mediaDetail.variants.length > 0 ? (
                    <Box
                      sx={{
                        bgcolor: 'var(--surface-container)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                      }}
                    >
                      {mediaDetail.variants.map((v, i) => (
                        <Box
                          key={v.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1.25,
                            borderBottom:
                              i === mediaDetail.variants.length - 1 ? 'none' : '1px solid var(--outline-variant)',
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              flexGrow: 1,
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--on-surface)',
                              fontVariationSettings: '"wght" 600, "opsz" 13',
                            }}
                          >
                            {v.variant_name}
                          </Box>
                          <Box component="span" sx={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                            {v.width} × {v.height}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              fontSize: 12,
                              color: 'var(--on-surface-variant)',
                              minWidth: 64,
                              textAlign: 'right',
                            }}
                          >
                            {formatFileSize(v.file_size)}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography sx={{ color: 'var(--on-surface-variant)' }} variant="body2">
                      {t('media.variants.none', 'No variants available')}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Tab 3: Usage */}
              {mainTab === 3 && (
                <Box>
                  {mediaUsage && mediaUsage.references.length > 0 ? (
                    <Box
                      sx={{
                        bgcolor: 'var(--surface-container)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                      }}
                    >
                      {mediaUsage.references.map((reference, i) => (
                        <Box
                          key={`${reference.content_type}:${reference.content_id}`}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1.25,
                            borderBottom:
                              i === mediaUsage.references.length - 1 ? 'none' : '1px solid var(--outline-variant)',
                          }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--on-surface)', fontWeight: 500 }}>
                            {reference.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.75 }}>
                            <Box
                              component="span"
                              sx={{
                                fontSize: 11,
                                px: 1,
                                py: 0.25,
                                borderRadius: '999px',
                                bgcolor: 'transparent',
                                border: '1px solid var(--outline-variant)',
                                color: 'var(--on-surface-variant)',
                                fontVariationSettings: '"wght" 600, "opsz" 11',
                                letterSpacing: 0.3,
                              }}
                            >
                              {reference.content_type}
                            </Box>
                            <Box
                              component="span"
                              sx={{
                                fontSize: 11,
                                px: 1,
                                py: 0.25,
                                borderRadius: '999px',
                                bgcolor: 'var(--primary-container)',
                                color: 'var(--on-primary-container)',
                                fontVariationSettings: '"wght" 600, "opsz" 11',
                                letterSpacing: 0.3,
                              }}
                            >
                              {reference.usage}
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography sx={{ color: 'var(--on-surface-variant)' }} variant="body2">
                      {t('media.usage.none', 'Not referenced by any content')}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
    </FormDialog>
  );
}
