import {
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import type { PageSectionResponse } from '@/types/api';
import { hasItemsEditor } from './SectionItemsEditor';
import SectionItemsLocalePanel from './SectionItemsLocalePanel';
import SectionTranslateDialog from './SectionTranslateDialog';
import type { SectionEditorModel } from './useSectionEditor';
import ImagePickActions from './ImagePickActions';

interface EditorProps {
  editor: SectionEditorModel;
}

/** "Suggest translation" (non-default locales) + "Generate content" — only when AI is configured. */
function SectionAiActions({ editor }: EditorProps) {
  const { t } = useTranslation();
  const { ai, currentLocale, isOnDefaultLocale, translation, handleGenerateContent } = editor;
  if (!ai.isConfigured) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      {!isOnDefaultLocale && currentLocale && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<TranslateIcon />}
          onClick={translation.handleOpenTranslate}
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
  );
}

/** Locale tab label with "exists" chip and unsaved-changes dot. */
function LocaleTabLabel({ code, hasLocalization, isDirty }: { code: string; hasLocalization: boolean; isDirty: boolean }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {code.toUpperCase()}
      {hasLocalization && <Chip label={t('forms.section.localeExists')} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
      {isDirty && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />}
    </Box>
  );
}

interface LocalizedContentProps extends EditorProps {
  /** Height of the rich-text editor. */
  editorHeight: number;
  /** Decorate locale tabs with localization/unsaved status. */
  showTabStatus?: boolean;
}

/** Locale tabs + the active locale's title / text / button fields. */
export function SectionLocalizedContent({ editor, editorHeight, showTabStatus = false }: LocalizedContentProps) {
  const { t } = useTranslation();
  const { state, dispatch, activeLocales, localizations } = editor;
  if (activeLocales.length === 0) {
    return <Typography color="text.secondary">{t('forms.section.noActiveLocales')}</Typography>;
  }

  return (
    <>
      <Tabs value={state.activeTab} onChange={editor.handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {activeLocales.map((locale) => (
          <Tab
            key={locale.id}
            label={showTabStatus ? (
              <LocaleTabLabel
                code={locale.code}
                hasLocalization={!!localizations?.some((l) => l.locale_id === locale.id)}
                isDirty={editor.isLocaleDirty(locale.id)}
              />
            ) : locale.code.toUpperCase()}
          />
        ))}
      </Tabs>
      <Stack spacing={2}>
        <SectionAiActions editor={editor} />
        <TextField label={t('blogDetail.fields.title')} fullWidth size="small" value={state.localeForm.title} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'title', value: e.target.value })} />
        <ForjaEditor value={state.localeForm.text} onChange={(val) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'text', value: val })} height={editorHeight} placeholder={t('editor.sectionPlaceholder')} siteId={editor.siteId} />
        <TextField label={t('forms.section.fields.buttonText')} fullWidth size="small" value={state.localeForm.buttonText} onChange={(e) => dispatch({ type: 'UPDATE_LOCALE_FIELD', field: 'buttonText', value: e.target.value })} />
      </Stack>
    </>
  );
}

/** Cover image picker: empty drop-target card, or the preview with change/remove actions. */
export function SectionCoverImageField({ editor }: EditorProps) {
  const { t } = useTranslation();
  const { state, dispatch, coverImageUrl } = editor;
  const openPicker = () => dispatch({ type: 'SET_PICKER_OPEN', value: true });

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('pageDetail.sections.coverImage')}</Typography>
      {!state.coverImageId ? (
        <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, cursor: 'pointer', bgcolor: 'action.hover' }} onClick={openPicker}>
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
            <ImagePickActions onChange={openPicker} onRemove={() => dispatch({ type: 'SET_COVER_IMAGE_ID', value: '' })} />
          </Stack>
        </Box>
      )}
    </Box>
  );
}

interface ItemsBlockProps extends EditorProps {
  section: PageSectionResponse;
  dividerSx?: SxProps<Theme>;
}

/**
 * Items editor for section types that have one, preceded by a divider.
 * Items get the locale dimension of the surrounding tabs: the default
 * locale edits settings.items directly; other locales manage a per-locale
 * override that falls back to the default when absent.
 */
export function SectionItemsBlock({ editor, section, dividerSx }: ItemsBlockProps) {
  const { state, dispatch, currentLocale, isOnDefaultLocale } = editor;
  if (!hasItemsEditor(section.section_type)) return null;

  return (
    <>
      <Divider sx={dividerSx} />
      <SectionItemsLocalePanel
        sectionType={section.section_type}
        defaultItems={(state.settings.items as Record<string, unknown>[]) || []}
        overrideItems={state.localeForm.items}
        isDefaultLocale={!currentLocale || isOnDefaultLocale}
        localeCode={currentLocale?.code ?? ''}
        onDefaultItemsChange={(items) => dispatch({ type: 'SET_SETTINGS', value: { ...state.settings, items } })}
        onOverrideChange={(items) => dispatch({ type: 'SET_LOCALE_ITEMS', value: items })}
      />
    </>
  );
}

/** Media picker + translation dialog shared by the panel and dialog layouts. */
export function SectionEditorOverlays({ editor }: EditorProps) {
  const { state, dispatch, currentLocale, translation, ai } = editor;
  return (
    <>
      <MediaPickerDialog open={state.pickerOpen} onClose={() => dispatch({ type: 'SET_PICKER_OPEN', value: false })} siteId={editor.siteId} currentValue={state.coverImageId || null} onSelect={(mediaId) => dispatch({ type: 'SET_COVER_IMAGE_ID', value: mediaId || '' })} />
      {currentLocale && (
        <SectionTranslateDialog
          open={translation.translateOpen}
          onClose={translation.handleCloseTranslate}
          targetLocaleCode={currentLocale.code}
          targetLocaleName={currentLocale.name}
          hasSourceContent={editor.hasSourceContent}
          preview={translation.translationPreview}
          onPreviewChange={translation.setTranslationPreview}
          onGenerate={translation.handleGenerateTranslation}
          onRefreshField={translation.handleRefreshTranslateField}
          onApply={translation.handleApplyTranslation}
          isGenerating={ai.isGenerating}
          refreshingField={translation.refreshingField}
        />
      )}
    </>
  );
}
