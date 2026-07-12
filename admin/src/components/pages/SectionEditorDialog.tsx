import { useEffect, useRef, useCallback, useMemo, useReducer, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
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
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { ForjaEditor } from '@/components/editor';
import { useQuery } from '@tanstack/react-query';
import { getSectionLocalizations } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import type { PageSectionResponse, SectionLocalizationResponse } from '@/types/api';
import SectionSettingsForm from './SectionSettingsForm';
import SectionItemsEditor, { hasItemsEditor } from './SectionItemsEditor';
import SectionTranslateDialog, {
  type SectionTranslationPreview,
} from './SectionTranslateDialog';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useSectionEditorSave } from './useSectionEditorSave';
import { useAiAssist } from '@/hooks/useAiAssist';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TranslateIcon from '@mui/icons-material/Translate';
import { queryKeys } from '@/lib/queryKeys';

/** Page-level context the dialog forwards to the AI Generate-Content action. */
export interface SectionPageContext {
  route?: string;
  title?: string;
  /** Section types already on the page, in display order — lets the model avoid repeating angles. */
  existingSectionTypes?: string[];
}

interface SectionEditorDialogProps {
  open: boolean;
  section: PageSectionResponse | null;
  onClose: () => void;
  /** When true, renders content without the Dialog wrapper (for use inside a Drawer) */
  embedded?: boolean;
  /** Page metadata used to ground AI section-content generation. Hidden when absent. */
  pageContext?: SectionPageContext;
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
  | { type: 'SET_PICKER_OPEN'; value: boolean };

const initialState: EditorState = {
  activeTab: 0, localeForm: { title: '', text: '', buttonText: '' },
  dirtyVersion: 0, coverImageId: '', ctaRoute: '', settings: {},
  pickerOpen: false,
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
  }
}

export default function SectionEditorDialog({ open, section, onClose, embedded, pageContext }: SectionEditorDialogProps) {
  const { t } = useTranslation();
  const { showError } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const ai = useAiAssist();

  const [state, dispatch] = useReducer(editorReducer, initialState);
  const coverImageUrl = useMediaUrl(state.coverImageId || undefined);

  const { dirtyLocalesRef, saveAll, queryClient } = useSectionEditorSave({
    sectionId: section?.id,
    pageId: section?.page_id,
  });

  const { data: siteLocalesRaw } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: localizations } = useQuery({
    queryKey: queryKeys.sectionLocalizations(section?.id),
    queryFn: () => getSectionLocalizations(section!.id),
    enabled: !!section,
  });

  const activeLocales = useMemo(
    () => (siteLocalesRaw || []).filter((sl) => sl.is_active).map((sl) => ({
      id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name,
      direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at,
      is_default: sl.is_default,
    })),
    [siteLocalesRaw],
  );
  const currentLocale = activeLocales[state.activeTab];
  const defaultLocale = useMemo(
    () => activeLocales.find((l) => l.is_default) ?? activeLocales[0],
    [activeLocales],
  );
  const isOnDefaultLocale = !!currentLocale && !!defaultLocale && currentLocale.id === defaultLocale.id;
  const defaultLocalization = useMemo(
    () => localizations?.find((l) => defaultLocale && l.locale_id === defaultLocale.id),
    [localizations, defaultLocale],
  );
  const hasSourceContent = !!(
    defaultLocalization && (defaultLocalization.title || defaultLocalization.text || defaultLocalization.button_text)
  );

  // Translation dialog state — local to the editor session, never persisted.
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translationPreview, setTranslationPreview] = useState<SectionTranslationPreview>(null);
  const [refreshingField, setRefreshingField] = useState<'title' | 'text' | 'button_text' | null>(null);

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
  useEffect(() => {
    const currentSectionKey = `${open}-${section?.id ?? null}`;
    const prevSectionKey = `${prevSectionRef.current.open}-${prevSectionRef.current.sectionId}`;
    if (currentSectionKey !== prevSectionKey) {
      prevSectionRef.current = { open, sectionId: section?.id ?? null };
      if (open && section) {
        dispatch({ type: 'INIT_SECTION', coverImageId: section.cover_image_id || '', ctaRoute: section.call_to_action_route || '', settings: section.settings ? { ...section.settings } : {} });
        dirtyLocalesRef.current.clear();
      }
    }
  });

  useEffect(() => {
    if (localizations && currentLocale) {
      const dirty = dirtyLocalesRef.current.get(currentLocale.id);
      if (dirty) dispatch({ type: 'SET_LOCALE_FORM', value: dirty });
      else populateLocForm(localizations.find((l) => l.locale_id === currentLocale.id));
    }
  }, [localizations, currentLocale, dirtyLocalesRef]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveAll(currentLocale?.id, state.localeForm, { coverImageId: state.coverImageId, ctaRoute: state.ctaRoute, settings: state.settings }, stashCurrentLocale);
      dispatch({ type: 'BUMP_DIRTY_VERSION' });
    } finally {
      setIsSaving(false);
    }
  }, [saveAll, currentLocale, state.localeForm, state.coverImageId, state.ctaRoute, state.settings, stashCurrentLocale]);

  const buildTranslateContent = useCallback(
    (overrideFields?: Partial<{ title: string; text: string; button_text: string }>) => {
      const src = {
        title: defaultLocalization?.title ?? '',
        text: defaultLocalization?.text ?? '',
        button_text: defaultLocalization?.button_text ?? '',
        ...overrideFields,
      };
      // Drop empty fields so the backend doesn't translate placeholders.
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(src)) {
        if (v) filtered[k] = v;
      }
      return JSON.stringify(filtered);
    },
    [defaultLocalization],
  );

  const handleOpenTranslate = useCallback(() => {
    setTranslationPreview(null);
    setTranslateOpen(true);
  }, []);

  const handleCloseTranslate = useCallback(() => {
    setTranslateOpen(false);
    setTranslationPreview(null);
  }, []);

  const handleGenerateTranslation = useCallback(async () => {
    if (!ai.isConfigured || !currentLocale || !hasSourceContent) return;
    try {
      const result = await ai.generate('translate', buildTranslateContent(), {
        targetLocale: currentLocale.code,
      });
      setTranslationPreview({
        title: result.title,
        text: result.text,
        button_text: result.button_text,
      });
    } catch (err) {
      showError(err);
    }
  }, [ai, currentLocale, hasSourceContent, buildTranslateContent, showError]);

  const handleRefreshTranslateField = useCallback(
    async (field: 'title' | 'text' | 'button_text') => {
      if (!ai.isConfigured || !currentLocale) return;
      const sourceValue =
        field === 'title'
          ? defaultLocalization?.title
          : field === 'text'
            ? defaultLocalization?.text
            : defaultLocalization?.button_text;
      if (!sourceValue) return;
      setRefreshingField(field);
      try {
        const result = await ai.generate(
          'translate',
          JSON.stringify({ [field]: sourceValue }),
          { targetLocale: currentLocale.code },
        );
        const translated = result[field];
        if (translated) {
          setTranslationPreview((prev) => (prev ? { ...prev, [field]: translated } : prev));
        }
      } catch (err) {
        showError(err);
      } finally {
        setRefreshingField(null);
      }
    },
    [ai, currentLocale, defaultLocalization, showError],
  );

  const handleApplyTranslation = useCallback(() => {
    if (!translationPreview) return;
    dispatch({
      type: 'SET_LOCALE_FORM',
      value: {
        title: translationPreview.title ?? state.localeForm.title,
        text: translationPreview.text ?? state.localeForm.text,
        buttonText: translationPreview.button_text ?? state.localeForm.buttonText,
      },
    });
    setTranslateOpen(false);
    setTranslationPreview(null);
  }, [translationPreview, state.localeForm]);

  const handleGenerateContent = useCallback(async () => {
    if (!section || !ai.isConfigured) return;
    try {
      const result = await ai.generate('section_content', '', {
        targetLocale: currentLocale?.code,
        sectionContext: {
          section_type: section.section_type,
          page_title: pageContext?.title,
          page_route: pageContext?.route,
          existing_section_types: pageContext?.existingSectionTypes ?? [],
        },
      });
      dispatch({
        type: 'SET_LOCALE_FORM',
        value: {
          title: result.title ?? '',
          text: result.text ?? '',
          buttonText: result.button_text ?? '',
        },
      });
    } catch (err) {
      showError(err);
    }
  }, [ai, section, currentLocale?.code, pageContext, showError]);

  useEffect(() => {
    if (currentLocale && open) {
      dirtyLocalesRef.current.set(currentLocale.id, state.localeForm);
    }
  }, [state.localeForm, currentLocale, open, dirtyLocalesRef]);

  const isDirty = dirtyLocalesRef.current.size > 0;

  // No autosave: persist any pending edits when the dialog closes so work
  // isn't lost, then close. Save errors are surfaced via saveAll's snackbar.
  const handleClose = useCallback(async () => {
    if (isDirty && section) {
      try {
        await handleSave();
      } catch {
        // already surfaced by the save hook
      }
    }
    if (section) queryClient.invalidateQueries({ queryKey: queryKeys.sectionLocalizations(section.id) });
    onClose();
  }, [isDirty, section, handleSave, queryClient, onClose]);

  const aiButtonsBar = ai.isConfigured ? (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      {!isOnDefaultLocale && currentLocale && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<TranslateIcon />}
          onClick={handleOpenTranslate}
          disabled={ai.isGenerating}
          data-testid="section-editor.btn.suggest-translation"
        >
          {t('forms.section.ai.suggestTranslation')}
        </Button>
      )}
      <Button
        size="small"
        variant="outlined"
        startIcon={<AutoAwesomeIcon />}
        onClick={handleGenerateContent}
        disabled={ai.isGenerating}
        data-testid="section-editor.btn.generate-content"
      >
        {ai.isGenerating
          ? t('forms.section.ai.generating')
          : t('forms.section.ai.generateContent')}
      </Button>
    </Box>
  ) : null;

  const translateDialogNode = currentLocale ? (
    <SectionTranslateDialog
      open={translateOpen}
      onClose={handleCloseTranslate}
      targetLocaleCode={currentLocale.code}
      targetLocaleName={currentLocale.name}
      hasSourceContent={hasSourceContent}
      preview={translationPreview}
      onPreviewChange={setTranslationPreview}
      onGenerate={handleGenerateTranslation}
      onRefreshField={handleRefreshTranslateField}
      onApply={handleApplyTranslation}
      isGenerating={ai.isGenerating}
      refreshingField={refreshingField}
    />
  ) : null;

  if (!section) return null;

  // Embedded mode: render content without Dialog wrapper (for use inside Drawer)
  if (embedded) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="section-editor.panel">
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{t('forms.section.title')}</Typography>
            <Chip label={t(`sectionEditor.typeNames.${section.section_type}`)} size="small" color="primary" variant="outlined" />
          </Box>
          <IconButton onClick={handleClose} aria-label={t('common.actions.close')}><CloseIcon /></IconButton>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
          {activeLocales.length > 0 ? (
            <>
              <Tabs value={state.activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
                {activeLocales.map((locale) => (
                  <Tab key={locale.id} label={locale.code.toUpperCase()} />
                ))}
              </Tabs>
              <Stack spacing={2}>
                {aiButtonsBar}
                <TextField label={t('blogDetail.fields.title')} fullWidth size="small" value={state.localeForm.title} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'title', value: e.target.value })} />
                <ForjaEditor value={state.localeForm.text} onChange={(val) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'text', value: val })} height={200} placeholder={t('editor.sectionPlaceholder')} siteId={selectedSiteId} />
                <TextField label={t('forms.section.fields.buttonText')} fullWidth size="small" value={state.localeForm.buttonText} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'buttonText', value: e.target.value })} />
              </Stack>
            </>
          ) : (
            <Typography color="text.secondary">{t('forms.section.noActiveLocales')}</Typography>
          )}
          <Divider sx={{ my: 2 }} />
          <SectionSettingsForm sectionType={section.section_type} settings={state.settings} onChange={(s) => dispatch({ type: 'SET_SETTINGS', value: s })} />
          {hasItemsEditor(section.section_type) && (
            <>
              <Divider sx={{ my: 2 }} />
              <SectionItemsEditor
                sectionType={section.section_type}
                items={(state.settings.items as Record<string, unknown>[]) || []}
                onChange={(items) => dispatch({ type: 'SET_SETTINGS', value: { ...state.settings, items } })}
              />
            </>
          )}
        </Box>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('common.actions.saving') : t('common.actions.save')}
          </Button>
        </Box>
        <MediaPickerDialog open={state.pickerOpen} onClose={() => dispatch({ type: 'SET_PICKER_OPEN', value: false })} siteId={selectedSiteId} currentValue={state.coverImageId || null} onSelect={(mediaId) => dispatch({ type: 'SET_COVER_IMAGE_ID', value: mediaId || '' })} />
        {translateDialogNode}
      </Box>
    );
  }

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      icon="view_quilt"
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {t('forms.section.title')}
          <Chip label={t(`sectionEditor.typeNames.${section.section_type}`)} size="small" color="primary" variant="outlined" />
        </Box>
      }
      maxWidth="lg"
      data-testid="section-editor.dialog"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={handleClose} disabled={isSaving} data-testid="section-editor.btn.close">
            {t('common.actions.close')}
          </M3Button>
          <Box sx={{ flex: 1 }} />
          <M3Button
            variant="filled"
            size="sm"
            icon="save"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="section-editor.btn.submit"
          >
            {isSaving ? t('common.actions.saving') : t('common.actions.save')}
          </M3Button>
        </>
      }
    >
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('forms.section.localizedContent')}</Typography>
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
                  {aiButtonsBar}
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
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('forms.section.sectionConfiguration')}</Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('pageDetail.sections.coverImage')}</Typography>
                {!state.coverImageId ? (
                  <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, cursor: 'pointer', bgcolor: 'action.hover' }} onClick={() => dispatch({ type: 'SET_PICKER_OPEN', value: true })}>
                    <Stack spacing={0.5} sx={{ alignItems: "center" }}>
                      <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">{t('blogDetail.images.selectImage')}</Typography>
                    </Stack>
                  </Card>
                ) : (
                  <Box>
                    <Card variant="outlined" sx={{ mb: 1 }}>
                      {coverImageUrl && <CardMedia component="img" height={100} image={coverImageUrl} alt="" sx={{ objectFit: 'cover' }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />}
                    </Card>
                    <Typography variant="caption" sx={{ mb: 0.5, fontFamily: "monospace", display: "block" }}>{state.coverImageId}</Typography>
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
              {hasItemsEditor(section.section_type) && (
                <>
                  <Divider />
                  <SectionItemsEditor
                    sectionType={section.section_type}
                    items={(state.settings.items as Record<string, unknown>[]) || []}
                    onChange={(items) => dispatch({ type: 'SET_SETTINGS', value: { ...state.settings, items } })}
                  />
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      <MediaPickerDialog open={state.pickerOpen} onClose={() => dispatch({ type: 'SET_PICKER_OPEN', value: false })} siteId={selectedSiteId} currentValue={state.coverImageId || null} onSelect={(mediaId) => dispatch({ type: 'SET_COVER_IMAGE_ID', value: mediaId || '' })} />
      {translateDialogNode}
    </FormDialog>
  );
}
