import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import SaveIcon from '@mui/icons-material/Save';
import { ForjaEditor } from '@/components/editor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  PageSectionResponse,
  UpdatePageSectionRequest,
  SectionLocalizationResponse,
  UpsertSectionLocalizationRequest,
} from '@/types/api';
import SectionSettingsForm from './SectionSettingsForm';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useAutosave } from '@/hooks/useAutosave';
import { useUserPreferences } from '@/store/UserPreferencesContext';

interface SectionEditorDialogProps {
  open: boolean;
  section: PageSectionResponse | null;
  onClose: () => void;
}

interface LocaleFormData {
  title: string;
  text: string;
  buttonText: string;
}

export default function SectionEditorDialog({ open, section, onClose }: SectionEditorDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { preferences: userPrefs } = useUserPreferences();

  // Locale tab state
  const [activeTab, setActiveTab] = useState(0);

  // Localization form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [buttonText, setButtonText] = useState('');

  // Track dirty locales: map of locale_id -> form data
  const dirtyLocalesRef = useRef<Map<string, LocaleFormData>>(new Map());
  const [dirtyVersion, setDirtyVersion] = useState(0);

  // Section metadata form state
  const [coverImageId, setCoverImageId] = useState('');
  const [ctaRoute, setCtaRoute] = useState('');
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const coverImageUrl = useMediaUrl(coverImageId || undefined);

  // Queries
  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: localizations } = useQuery({
    queryKey: ['section-localizations', section?.id],
    queryFn: () => apiService.getSectionLocalizations(section!.id),
    enabled: !!section,
  });

  const activeLocales = useMemo(
    () => (siteLocalesRaw || [])
      .filter((sl) => sl.is_active)
      .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at })),
    [siteLocalesRaw],
  );
  const currentLocale = activeLocales[activeTab];

  // Populate localization form when switching tabs or data loads
  const populateLocForm = (loc: SectionLocalizationResponse | undefined) => {
    setTitle(loc?.title || '');
    setText(loc?.text || '');
    setButtonText(loc?.button_text || '');
  };

  // Mark a locale as dirty and bump version to trigger tab re-render
  const markLocaleDirty = useCallback((localeId: string, data: LocaleFormData) => {
    dirtyLocalesRef.current.set(localeId, data);
    setDirtyVersion((v) => v + 1);
  }, []);

  // Save current locale form data to dirty map before switching tabs
  const stashCurrentLocale = useCallback(() => {
    if (currentLocale) {
      markLocaleDirty(currentLocale.id, { title, text, buttonText });
    }
  }, [currentLocale, title, text, buttonText, markLocaleDirty]);

  const handleTabChange = (_: unknown, newValue: number) => {
    stashCurrentLocale();
    setActiveTab(newValue);
    const locale = activeLocales[newValue];
    // Check dirty map first, then fall back to API data
    const dirty = locale ? dirtyLocalesRef.current.get(locale.id) : undefined;
    if (dirty) {
      setTitle(dirty.title);
      setText(dirty.text);
      setButtonText(dirty.buttonText);
    } else {
      const loc = localizations?.find((l) => locale && l.locale_id === locale.id);
      populateLocForm(loc);
    }
  };

  // Initialize section metadata when dialog opens or section changes
  useEffect(() => {
    if (open && section) {
      setCoverImageId(section.cover_image_id || '');
      setCtaRoute(section.call_to_action_route || '');
      setSettings(section.settings ? { ...section.settings } : {});
      setActiveTab(0);
      dirtyLocalesRef.current.clear();
      setDirtyVersion(0);
    }
  }, [open, section]);

  // Initialize localization form when data loads
  useEffect(() => {
    if (localizations && currentLocale) {
      const dirty = dirtyLocalesRef.current.get(currentLocale.id);
      if (dirty) {
        setTitle(dirty.title);
        setText(dirty.text);
        setButtonText(dirty.buttonText);
      } else {
        const loc = localizations.find((l) => l.locale_id === currentLocale.id);
        populateLocForm(loc);
      }
    }
  }, [localizations, currentLocale]);

  // Mutations — don't invalidate section-localizations on save; form state is
  // the source of truth while the dialog is open.  Invalidate on close instead.
  const upsertLocMutation = useMutation({
    mutationFn: (data: UpsertSectionLocalizationRequest) =>
      apiService.upsertSectionLocalization(section!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-section-localizations'] });
    },
    onError: (error) => showError(error),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (data: UpdatePageSectionRequest) =>
      apiService.updatePageSection(section!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', section?.page_id] });
    },
    onError: (error) => showError(error),
  });

  // Save all dirty locales + current locale + section config
  const handleSave = useCallback(async () => {
    // Stash current locale data first
    stashCurrentLocale();

    // Save all dirty locales
    const dirtyEntries = Array.from(dirtyLocalesRef.current.entries());
    for (const [localeId, data] of dirtyEntries) {
      await upsertLocMutation.mutateAsync({
        locale_id: localeId,
        title: data.title || undefined,
        text: data.text || undefined,
        button_text: data.buttonText || undefined,
      });
    }

    // Also save current locale if not already in dirty map
    if (currentLocale && !dirtyLocalesRef.current.has(currentLocale.id)) {
      await upsertLocMutation.mutateAsync({
        locale_id: currentLocale.id,
        title: title || undefined,
        text: text || undefined,
        button_text: buttonText || undefined,
      });
    }

    // Save section config
    await updateSectionMutation.mutateAsync({
      cover_image_id: coverImageId || undefined,
      call_to_action_route: ctaRoute || undefined,
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    });

    dirtyLocalesRef.current.clear();
    setDirtyVersion((v) => v + 1);
  }, [stashCurrentLocale, currentLocale, title, text, buttonText,
      coverImageId, ctaRoute, settings, upsertLocMutation, updateSectionMutation]);

  // Track current locale form data in dirty map (ref-only, no state bump to avoid
  // infinite re-render — the active tab's dot is visible because parent re-renders
  // from title/text/buttonText state, and stashCurrentLocale bumps version on tab switch)
  useEffect(() => {
    if (currentLocale && open) {
      dirtyLocalesRef.current.set(currentLocale.id, { title, text, buttonText });
      setFormVersion((v) => v + 1);
    }
  }, [title, text, buttonText, currentLocale, open]);

  // Autosave — uses same hook as blog/page detail editors (3s debounce, retries)
  const isDirty = dirtyLocalesRef.current.size > 0;
  const { status: autosaveStatus, flush } = useAutosave({
    isDirty,
    onSave: handleSave,
    enabled: open && !!section && userPrefs.autosave_enabled,
    debounceMs: userPrefs.autosave_debounce_seconds * 1000,
    formVersion,
    onError: (err) => showError(err),
  });

  const isSaving = autosaveStatus === 'saving';

  // Invalidate section-localizations when the dialog closes so next open gets fresh data
  const handleClose = useCallback(async () => {
    // Flush any pending autosave before closing
    await flush();
    if (section) {
      queryClient.invalidateQueries({ queryKey: ['section-localizations', section.id] });
    }
    onClose();
  }, [flush, section, queryClient, onClose]);

  if (!section) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth aria-labelledby="section-editor-dialog-title" data-testid="section-editor.dialog">
      <DialogTitle id="section-editor-dialog-title" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {t('forms.section.title')}
          <Chip label={section.section_type} size="small" color="primary" variant="outlined" />
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label={t('common.actions.close')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Left panel: Localized content (60%) */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              {t('forms.section.localizedContent')}
            </Typography>

            {activeLocales.length > 0 ? (
              <>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ mb: 2 }}
                >
                  {activeLocales.map((locale) => {
                    const hasLoc = localizations?.some((l) => l.locale_id === locale.id);
                    // dirtyVersion is read to trigger re-render when dirty state changes
                    const isDirty = dirtyVersion >= 0 && dirtyLocalesRef.current.has(locale.id);
                    return (
                      <Tab
                        key={locale.id}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {locale.code.toUpperCase()}
                            {hasLoc && (
                              <Chip
                                label={t('forms.section.localeExists')}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                            {isDirty && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: 'warning.main',
                                }}
                              />
                            )}
                          </Box>
                        }
                      />
                    );
                  })}
                </Tabs>

                <Stack spacing={2}>
                  <TextField
                    label={t('blogDetail.fields.title')}
                    fullWidth
                    size="small"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <ForjaEditor
                    value={text}
                    onChange={(val) => setText(val)}
                    height={250}
                    placeholder={t('editor.sectionPlaceholder')}
                    siteId={selectedSiteId}
                  />

                  <TextField
                    label={t('forms.section.fields.buttonText')}
                    fullWidth
                    size="small"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                  />
                </Stack>
              </>
            ) : (
              <Typography color="text.secondary">{t('forms.section.noActiveLocales')}</Typography>
            )}
          </Grid>

          {/* Right panel: Section configuration (40%) */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              {t('forms.section.sectionConfiguration')}
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('pageDetail.sections.coverImage')}
                </Typography>
                {!coverImageId ? (
                  <Card
                    variant="outlined"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 100,
                      cursor: 'pointer',
                      bgcolor: 'action.hover',
                    }}
                    onClick={() => setPickerOpen(true)}
                  >
                    <Stack alignItems="center" spacing={0.5}>
                      <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {t('blogDetail.images.selectImage')}
                      </Typography>
                    </Stack>
                  </Card>
                ) : (
                  <Box>
                    <Card variant="outlined" sx={{ mb: 1 }}>
                      {coverImageUrl && (
                        <CardMedia
                          component="img"
                          height={100}
                          image={coverImageUrl}
                          alt=""
                          sx={{ objectFit: 'cover' }}
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </Card>
                    <Typography variant="caption" fontFamily="monospace" display="block" sx={{ mb: 0.5 }}>
                      {coverImageId}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)}>
                        {t('blogDetail.images.changeImage')}
                      </Button>
                      <Button size="small" color="error" onClick={() => setCoverImageId('')}>
                        {t('blogDetail.images.removeImage')}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Box>

              <TextField
                label={t('forms.section.fields.ctaRoute')}
                fullWidth
                size="small"
                value={ctaRoute}
                onChange={(e) => setCtaRoute(e.target.value)}
                helperText={t('forms.section.fields.ctaHelperText')}
              />

              <Divider />

              <SectionSettingsForm
                sectionType={section.section_type}
                settings={settings}
                onChange={setSettings}
              />
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSaving} data-testid="section-editor.btn.close">
          {t('common.actions.close')}
        </Button>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {autosaveStatus === 'saving' && (
            <Chip label={t('blogDetail.toolbar.saving')} size="small" color="info" variant="outlined" />
          )}
          {autosaveStatus === 'saved' && (
            <Chip label={t('blogDetail.toolbar.saved')} size="small" color="success" variant="outlined" />
          )}
          {autosaveStatus === 'error' && (
            <Chip label={t('blogDetail.toolbar.saveFailed')} size="small" color="error" variant="outlined" />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
          data-testid="section-editor.btn.submit"
        >
          {isSaving ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </DialogActions>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        siteId={selectedSiteId}
        currentValue={coverImageId || null}
        onSelect={(mediaId) => setCoverImageId(mediaId || '')}
      />
    </Dialog>
  );
}
