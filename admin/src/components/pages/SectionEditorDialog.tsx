import { useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { PageSectionResponse, SectionLocalizationResponse } from '@/types/api';
import SectionSettingsForm from './SectionSettingsForm';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useAutosave } from '@/hooks/useAutosave';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useSectionEditorSave } from './useSectionEditorSave';

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

// --- Reducer ---

interface EditorState {
  activeTab: number;
  localeForm: LocaleFormData;
  dirtyVersion: number;
  coverImageId: string;
  ctaRoute: string;
  settings: Record<string, unknown>;
  pickerOpen: boolean;
  formVersion: number;
}

type EditorAction =
  | { type: 'INIT_SECTION'; coverImageId: string; ctaRoute: string; settings: Record<string, unknown> }
  | { type: 'SET_ACTIVE_TAB'; value: number }
  | { type: 'SET_LOCALE_FORM'; value: LocaleFormData }
  | { type: 'UPDATE_LOCALE_FIELD'; field: keyof LocaleFormData; value: string }
  | { type: 'BUMP_DIRTY_VERSION' }
  | { type: 'SET_COVER_IMAGE_ID'; value: string }
  | { type: 'SET_CTA_ROUTE'; value: string }
  | { type: 'SET_SETTINGS'; value: Record<string, unknown> }
  | { type: 'SET_PICKER_OPEN'; value: boolean }
  | { type: 'BUMP_FORM_VERSION' };

const initialState: EditorState = {
  activeTab: 0, localeForm: { title: '', text: '', buttonText: '' },
  dirtyVersion: 0, coverImageId: '', ctaRoute: '', settings: {},
  pickerOpen: false, formVersion: 0,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'INIT_SECTION': return { ...initialState, coverImageId: action.coverImageId, ctaRoute: action.ctaRoute, settings: action.settings };
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value };
    case 'SET_LOCALE_FORM': return { ...state, localeForm: action.value };
    case 'UPDATE_LOCALE_FIELD': return { ...state, localeForm: { ...state.localeForm, [action.field]: action.value } };
    case 'BUMP_DIRTY_VERSION': return { ...state, dirtyVersion: state.dirtyVersion + 1 };
    case 'SET_COVER_IMAGE_ID': return { ...state, coverImageId: action.value };
    case 'SET_CTA_ROUTE': return { ...state, ctaRoute: action.value };
    case 'SET_SETTINGS': return { ...state, settings: action.value };
    case 'SET_PICKER_OPEN': return { ...state, pickerOpen: action.value };
    case 'BUMP_FORM_VERSION': return { ...state, formVersion: state.formVersion + 1 };
  }
}

export default function SectionEditorDialog({ open, section, onClose }: SectionEditorDialogProps) {
  const { t } = useTranslation();
  const { showError } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { preferences: userPrefs } = useUserPreferences();

  const [state, dispatch] = useReducer(editorReducer, initialState);
  const coverImageUrl = useMediaUrl(state.coverImageId || undefined);

  const { dirtyLocalesRef, saveAll, queryClient } = useSectionEditorSave({
    sectionId: section?.id,
    pageId: section?.page_id,
  });

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
    () => (siteLocalesRaw || []).filter((sl) => sl.is_active).map((sl) => ({
      id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name,
      direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at,
    })),
    [siteLocalesRaw],
  );
  const currentLocale = activeLocales[state.activeTab];

  const populateLocForm = (loc: SectionLocalizationResponse | undefined) => {
    dispatch({ type: 'SET_LOCALE_FORM', value: { title: loc?.title || '', text: loc?.text || '', buttonText: loc?.button_text || '' } });
  };

  const markLocaleDirty = useCallback((localeId: string, data: LocaleFormData) => {
    dirtyLocalesRef.current.set(localeId, data);
    dispatch({ type: 'BUMP_DIRTY_VERSION' });
  }, [dirtyLocalesRef]);

  const stashCurrentLocale = useCallback(() => {
    if (currentLocale) markLocaleDirty(currentLocale.id, state.localeForm);
  }, [currentLocale, state.localeForm, markLocaleDirty]);

  const handleTabChange = (_: unknown, newValue: number) => {
    stashCurrentLocale();
    dispatch({ type: 'SET_ACTIVE_TAB', value: newValue });
    const locale = activeLocales[newValue];
    const dirty = locale ? dirtyLocalesRef.current.get(locale.id) : undefined;
    if (dirty) dispatch({ type: 'SET_LOCALE_FORM', value: dirty });
    else populateLocForm(localizations?.find((l) => locale && l.locale_id === locale.id));
  };

  // Initialize section metadata when dialog opens or section changes
  const prevSectionRef = useRef<{ open: boolean; sectionId: string | null }>({ open: false, sectionId: null });
  const currentSectionKey = `${open}-${section?.id ?? null}`;
  const prevSectionKey = `${prevSectionRef.current.open}-${prevSectionRef.current.sectionId}`;
  if (currentSectionKey !== prevSectionKey) {
    prevSectionRef.current = { open, sectionId: section?.id ?? null };
    if (open && section) {
      dispatch({ type: 'INIT_SECTION', coverImageId: section.cover_image_id || '', ctaRoute: section.call_to_action_route || '', settings: section.settings ? { ...section.settings } : {} });
      dirtyLocalesRef.current.clear();
    }
  }

  useEffect(() => {
    if (localizations && currentLocale) {
      const dirty = dirtyLocalesRef.current.get(currentLocale.id);
      if (dirty) dispatch({ type: 'SET_LOCALE_FORM', value: dirty });
      else populateLocForm(localizations.find((l) => l.locale_id === currentLocale.id));
    }
  }, [localizations, currentLocale, dirtyLocalesRef]);

  const handleSave = useCallback(async () => {
    await saveAll(currentLocale?.id, state.localeForm, { coverImageId: state.coverImageId, ctaRoute: state.ctaRoute, settings: state.settings }, stashCurrentLocale);
    dispatch({ type: 'BUMP_DIRTY_VERSION' });
  }, [saveAll, currentLocale, state.localeForm, state.coverImageId, state.ctaRoute, state.settings, stashCurrentLocale]);

  useEffect(() => {
    if (currentLocale && open) {
      dirtyLocalesRef.current.set(currentLocale.id, state.localeForm);
      dispatch({ type: 'BUMP_FORM_VERSION' });
    }
  }, [state.localeForm, currentLocale, open, dirtyLocalesRef]);

  const isDirty = dirtyLocalesRef.current.size > 0;
  const { status: autosaveStatus, flush } = useAutosave({
    isDirty, onSave: handleSave, enabled: open && !!section && userPrefs.autosave_enabled,
    debounceMs: userPrefs.autosave_debounce_seconds * 1000, formVersion: state.formVersion,
    onError: (err) => showError(err),
  });

  const isSaving = autosaveStatus === 'saving';

  const handleClose = useCallback(async () => {
    await flush();
    if (section) queryClient.invalidateQueries({ queryKey: ['section-localizations', section.id] });
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
        <IconButton onClick={handleClose} size="small" aria-label={t('common.actions.close')}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>{t('forms.section.localizedContent')}</Typography>
            {activeLocales.length > 0 ? (
              <>
                <Tabs value={state.activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
                  {activeLocales.map((locale) => {
                    const hasLoc = localizations?.some((l) => l.locale_id === locale.id);
                    const isDirtyLocale = state.dirtyVersion >= 0 && dirtyLocalesRef.current.has(locale.id);
                    return (
                      <Tab key={locale.id} label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {locale.code.toUpperCase()}
                          {hasLoc && <Chip label={t('forms.section.localeExists')} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                          {isDirtyLocale && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />}
                        </Box>
                      } />
                    );
                  })}
                </Tabs>
                <Stack spacing={2}>
                  <TextField label={t('blogDetail.fields.title')} fullWidth size="small" value={state.localeForm.title} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'title', value: e.target.value })} />
                  <ForjaEditor value={state.localeForm.text} onChange={(val) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'text', value: val })} height={250} placeholder={t('editor.sectionPlaceholder')} siteId={selectedSiteId} />
                  <TextField label={t('forms.section.fields.buttonText')} fullWidth size="small" value={state.localeForm.buttonText} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'buttonText', value: e.target.value })} />
                </Stack>
              </>
            ) : (
              <Typography color="text.secondary">{t('forms.section.noActiveLocales')}</Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>{t('forms.section.sectionConfiguration')}</Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('pageDetail.sections.coverImage')}</Typography>
                {!state.coverImageId ? (
                  <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, cursor: 'pointer', bgcolor: 'action.hover' }} onClick={() => dispatch({ type: 'SET_PICKER_OPEN', value: true })}>
                    <Stack alignItems="center" spacing={0.5}>
                      <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">{t('blogDetail.images.selectImage')}</Typography>
                    </Stack>
                  </Card>
                ) : (
                  <Box>
                    <Card variant="outlined" sx={{ mb: 1 }}>
                      {coverImageUrl && <CardMedia component="img" height={100} image={coverImageUrl} alt="" sx={{ objectFit: 'cover' }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />}
                    </Card>
                    <Typography variant="caption" fontFamily="monospace" display="block" sx={{ mb: 0.5 }}>{state.coverImageId}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => dispatch({ type: 'SET_PICKER_OPEN', value: true })}>{t('blogDetail.images.changeImage')}</Button>
                      <Button size="small" color="error" onClick={() => dispatch({ type: 'SET_COVER_IMAGE_ID', value: '' })}>{t('blogDetail.images.removeImage')}</Button>
                    </Stack>
                  </Box>
                )}
              </Box>
              <TextField label={t('forms.section.fields.ctaRoute')} fullWidth size="small" value={state.ctaRoute} onChange={(e) => dispatch({ type: 'SET_CTA_ROUTE', value: e.target.value })} helperText={t('forms.section.fields.ctaHelperText')} />
              <Divider />
              <SectionSettingsForm sectionType={section.section_type} settings={state.settings} onChange={(val) => dispatch({ type: 'SET_SETTINGS', value: val })} />
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSaving} data-testid="section-editor.btn.close">{t('common.actions.close')}</Button>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {autosaveStatus === 'saving' && <Chip label={t('blogDetail.toolbar.saving')} size="small" color="info" variant="outlined" />}
          {autosaveStatus === 'saved' && <Chip label={t('blogDetail.toolbar.saved')} size="small" color="success" variant="outlined" />}
          {autosaveStatus === 'error' && <Chip label={t('blogDetail.toolbar.saveFailed')} size="small" color="error" variant="outlined" />}
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={isSaving} data-testid="section-editor.btn.submit">
          {isSaving ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </DialogActions>
      <MediaPickerDialog open={state.pickerOpen} onClose={() => dispatch({ type: 'SET_PICKER_OPEN', value: false })} siteId={selectedSiteId} currentValue={state.coverImageId || null} onSelect={(mediaId) => dispatch({ type: 'SET_COVER_IMAGE_ID', value: mediaId || '' })} />
    </Dialog>
  );
}
