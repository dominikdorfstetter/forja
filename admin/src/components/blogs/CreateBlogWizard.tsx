import { useReducer, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  TextField,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAuth } from '@/store/AuthContext';
import { useAiAssist } from '@/hooks/useAiAssist';
import { slugField, requiredString } from '@/utils/validation';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';
import BlogWizardMethodStep from './BlogWizardMethodStep';
import BlogWizardTemplateStep, { buildMergedTemplates } from './BlogWizardTemplateStep';
import BlogWizardImportStep from './BlogWizardImportStep';
import BlogWizardAiStep from './BlogWizardAiStep';
import { useBlogWizardMutations } from './useBlogWizardMutations';

type CreationMethod = 'scratch' | 'template' | 'import' | 'ai';
type AiPhase = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };

const scratchSchema = z.object({ slug: slugField, author: requiredString(200) });
type ScratchFormData = z.infer<typeof scratchSchema>;

const STEP_KEYS = ['blogs.wizard.steps.method', 'blogs.wizard.steps.details'] as const;
const EMPTY_TEMPLATES: ContentTemplate[] = [];

// --- Reducer ---

interface WizardState {
  activeStep: number;
  method: CreationMethod | null;
  aiPhase: AiPhase;
  aiIdea: string;
  aiTitle: string;
  aiSubtitle: string;
  aiOutline: OutlineItem[];
  aiBody: string;
  aiExcerpt: string;
  aiMetaTitle: string;
  aiMetaDescription: string;
  aiError: string | null;
  selectedTemplate: string | null;
  templateSearch: string;
  templatePage: number;
  importPhase: 'upload' | 'preview';
  dragOver: boolean;
  importError: string | null;
  fileName: string;
  fileSize: number;
  parsed: MarkdownParseResult | null;
  importTitle: string;
  importExcerpt: string;
  importSlug: string;
}

type WizardAction =
  | { type: 'RESET' }
  | { type: 'SELECT_METHOD'; method: CreationMethod }
  | { type: 'GO_BACK_TO_STEP0' }
  | { type: 'SET_AI_PHASE'; value: AiPhase }
  | { type: 'SET_AI_IDEA'; value: string }
  | { type: 'SET_AI_TITLE'; value: string }
  | { type: 'SET_AI_SUBTITLE'; value: string }
  | { type: 'SET_AI_OUTLINE'; value: OutlineItem[] }
  | { type: 'SET_AI_BODY'; value: string }
  | { type: 'SET_AI_EXCERPT'; value: string }
  | { type: 'SET_AI_ERROR'; value: string | null }
  | { type: 'OUTLINE_GENERATED'; title: string; subtitle: string; outline: OutlineItem[] }
  | { type: 'POST_GENERATED'; body: string; excerpt: string; metaTitle: string; metaDescription: string }
  | { type: 'SET_SELECTED_TEMPLATE'; value: string | null }
  | { type: 'SET_TEMPLATE_SEARCH'; value: string }
  | { type: 'SET_TEMPLATE_PAGE'; value: number }
  | { type: 'SET_IMPORT_PHASE'; value: 'upload' | 'preview' }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IMPORT_ERROR'; value: string | null }
  | { type: 'SET_FILE_NAME'; value: string }
  | { type: 'SET_FILE_SIZE'; value: number }
  | { type: 'FILE_PARSED'; parsed: MarkdownParseResult; title: string; excerpt: string; slug: string }
  | { type: 'SET_IMPORT_TITLE'; value: string }
  | { type: 'SET_IMPORT_EXCERPT'; value: string }
  | { type: 'SET_IMPORT_SLUG'; value: string };

const initialState: WizardState = {
  activeStep: 0, method: null,
  aiPhase: 'idea', aiIdea: '', aiTitle: '', aiSubtitle: '', aiOutline: [],
  aiBody: '', aiExcerpt: '', aiMetaTitle: '', aiMetaDescription: '', aiError: null,
  selectedTemplate: null, templateSearch: '', templatePage: 0,
  importPhase: 'upload', dragOver: false, importError: null,
  fileName: '', fileSize: 0, parsed: null,
  importTitle: '', importExcerpt: '', importSlug: '',
};

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'RESET': return initialState;
    case 'SELECT_METHOD': return { ...state, method: action.method, activeStep: 1 };
    case 'GO_BACK_TO_STEP0': return { ...state, activeStep: 0, method: null };
    case 'SET_AI_PHASE': return { ...state, aiPhase: action.value };
    case 'SET_AI_IDEA': return { ...state, aiIdea: action.value };
    case 'SET_AI_TITLE': return { ...state, aiTitle: action.value };
    case 'SET_AI_SUBTITLE': return { ...state, aiSubtitle: action.value };
    case 'SET_AI_OUTLINE': return { ...state, aiOutline: action.value };
    case 'SET_AI_BODY': return { ...state, aiBody: action.value };
    case 'SET_AI_EXCERPT': return { ...state, aiExcerpt: action.value };
    case 'SET_AI_ERROR': return { ...state, aiError: action.value };
    case 'OUTLINE_GENERATED': return { ...state, aiTitle: action.title || state.aiTitle, aiSubtitle: action.subtitle || state.aiSubtitle, aiOutline: action.outline, aiPhase: 'outline', aiError: null };
    case 'POST_GENERATED': return { ...state, aiBody: action.body || state.aiBody, aiExcerpt: action.excerpt || state.aiExcerpt, aiMetaTitle: action.metaTitle || state.aiMetaTitle, aiMetaDescription: action.metaDescription || state.aiMetaDescription, aiPhase: 'post', aiError: null };
    case 'SET_SELECTED_TEMPLATE': return { ...state, selectedTemplate: action.value };
    case 'SET_TEMPLATE_SEARCH': return { ...state, templateSearch: action.value, templatePage: 0, selectedTemplate: null };
    case 'SET_TEMPLATE_PAGE': return { ...state, templatePage: action.value };
    case 'SET_IMPORT_PHASE': return { ...state, importPhase: action.value };
    case 'SET_DRAG_OVER': return { ...state, dragOver: action.value };
    case 'SET_IMPORT_ERROR': return { ...state, importError: action.value };
    case 'SET_FILE_NAME': return { ...state, fileName: action.value };
    case 'SET_FILE_SIZE': return { ...state, fileSize: action.value };
    case 'FILE_PARSED': return { ...state, parsed: action.parsed, importTitle: action.title, importExcerpt: action.excerpt, importSlug: action.slug, importPhase: 'preview' };
    case 'SET_IMPORT_TITLE': return { ...state, importTitle: action.value };
    case 'SET_IMPORT_EXCERPT': return { ...state, importExcerpt: action.value };
    case 'SET_IMPORT_SLUG': return { ...state, importSlug: action.value };
  }
}

interface CreateBlogWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (blogId: string) => void;
  siteLocales: SiteLocaleResponse[] | undefined;
  siteTemplates: ContentTemplate[] | undefined;
  siteTemplatesLoading: boolean;
}

export default function CreateBlogWizard({
  open, onClose, onCreated, siteLocales,
  siteTemplates = EMPTY_TEMPLATES, siteTemplatesLoading,
}: CreateBlogWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userFullName, isAdmin } = useAuth();
  const { isConfigured: aiAvailable, generate: aiGenerate, isGenerating } = useAiAssist();

  const [state, dispatch] = useReducer(reducer, initialState);
  const outlineIdCounter = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const { register, handleSubmit, reset: resetForm, formState: { errors } } = useForm<ScratchFormData>({
    resolver: zodResolver(scratchSchema),
    defaultValues: { slug: '', author: userFullName || '' },
    mode: 'onChange',
  });

  const { scratchMutation, templateMutation, importMutation, aiMutation, isCreating } =
    useBlogWizardMutations({
      siteLocales,
      onClose,
      onCreated,
      getAiState: () => stateRef.current,
    });

  // Reset when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    dispatch({ type: 'RESET' });
    outlineIdCounter.current = 0;
    resetForm({ slug: '', author: userFullName || '' });
  }
  prevOpenRef.current = open;

  // --- AI handlers ---
  const handleAiGenerateOutline = async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    try {
      const result = await aiGenerate('draft_outline', state.aiIdea);
      dispatch({
        type: 'OUTLINE_GENERATED',
        title: result.title || '',
        subtitle: result.subtitle || '',
        outline: (result.outline || []).map((v: string) => ({ id: outlineIdCounter.current++, value: v })),
      });
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.outlineError') });
    }
  };

  const handleAiGeneratePost = async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    const content = JSON.stringify({ title: state.aiTitle, subtitle: state.aiSubtitle, outline: state.aiOutline.map(item => item.value) });
    try {
      const result = await aiGenerate('draft_post', content);
      dispatch({ type: 'POST_GENERATED', body: result.body || '', excerpt: result.excerpt || '', metaTitle: result.meta_title || '', metaDescription: result.meta_description || '' });
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.postError') });
    }
  };

  const handleTemplateConfirm = () => {
    const tpl = buildMergedTemplates(t, siteTemplates).find((mt) => mt.id === state.selectedTemplate);
    if (!tpl) return;
    if (tpl.source === 'builtin' && tpl.builtin) templateMutation.mutate({ template: tpl.builtin, source: 'builtin' });
    else if (tpl.source === 'custom' && tpl.custom) templateMutation.mutate({ template: tpl.custom, source: 'custom' });
  };

  const handleImportConfirm = () => {
    if (!state.parsed) return;
    importMutation.mutate({ ...state.parsed, title: state.importTitle, excerpt: state.importExcerpt, slug: state.importSlug, meta_title: state.importTitle.slice(0, 200) });
  };

  const handleBack = () => {
    if (state.method === 'import' && state.importPhase === 'preview') { dispatch({ type: 'SET_IMPORT_PHASE', value: 'upload' }); dispatch({ type: 'SET_IMPORT_ERROR', value: null }); return; }
    if (state.method === 'ai') {
      if (state.aiPhase === 'post') { dispatch({ type: 'SET_AI_PHASE', value: 'outline' }); return; }
      if (state.aiPhase === 'outline') { dispatch({ type: 'SET_AI_PHASE', value: 'idea' }); return; }
    }
    dispatch({ type: 'GO_BACK_TO_STEP0' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={state.method === 'template' || state.method === 'ai' || (state.activeStep === 0 && aiAvailable) ? 'md' : 'sm'} fullWidth aria-labelledby="create-blog-wizard-title" data-testid="create-blog-wizard">
      <DialogTitle id="create-blog-wizard-title">{t('blogs.wizard.title')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={state.activeStep} sx={{ mb: 3, mt: 1 }}>
          {STEP_KEYS.map((key) => (<Step key={key}><StepLabel>{t(key)}</StepLabel></Step>))}
        </Stepper>

        {state.activeStep === 0 && (
          <BlogWizardMethodStep method={state.method} onSelect={(m) => dispatch({ type: 'SELECT_METHOD', method: m })} aiAvailable={aiAvailable} />
        )}

        {state.activeStep === 1 && state.method === 'scratch' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField autoFocus label={t('blogs.wizard.fields.slug')} fullWidth required {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message || t('blogs.wizard.fields.slugHint')} data-testid="create-blog-wizard.input.slug" />
            <TextField label={t('blogs.wizard.fields.author')} fullWidth required {...register('author')} error={!!errors.author} helperText={errors.author?.message} data-testid="create-blog-wizard.input.author" />
          </Box>
        )}

        {state.activeStep === 1 && state.method === 'template' && (
          <BlogWizardTemplateStep selectedTemplate={state.selectedTemplate} onSelectTemplate={(v) => dispatch({ type: 'SET_SELECTED_TEMPLATE', value: v })} templateSearch={state.templateSearch} onSearchChange={(v) => dispatch({ type: 'SET_TEMPLATE_SEARCH', value: v })} templatePage={state.templatePage} onPageChange={(v) => dispatch({ type: 'SET_TEMPLATE_PAGE', value: v })} siteTemplates={siteTemplates} siteTemplatesLoading={siteTemplatesLoading} />
        )}

        {state.activeStep === 1 && state.method === 'import' && (
          <BlogWizardImportStep importPhase={state.importPhase} dragOver={state.dragOver} importError={state.importError} fileName={state.fileName} fileSize={state.fileSize} parsed={state.parsed} importTitle={state.importTitle} importExcerpt={state.importExcerpt} importSlug={state.importSlug} onDragOver={(v) => dispatch({ type: 'SET_DRAG_OVER', value: v })} onImportError={(v) => dispatch({ type: 'SET_IMPORT_ERROR', value: v })} onFileName={(v) => dispatch({ type: 'SET_FILE_NAME', value: v })} onFileSize={(v) => dispatch({ type: 'SET_FILE_SIZE', value: v })} onParsed={(parsed, title, excerpt, slug) => dispatch({ type: 'FILE_PARSED', parsed, title, excerpt, slug })} onImportTitleChange={(v) => dispatch({ type: 'SET_IMPORT_TITLE', value: v })} onImportExcerptChange={(v) => dispatch({ type: 'SET_IMPORT_EXCERPT', value: v })} onImportSlugChange={(v) => dispatch({ type: 'SET_IMPORT_SLUG', value: v })} />
        )}

        {state.activeStep === 1 && state.method === 'ai' && (
          <BlogWizardAiStep aiPhase={state.aiPhase} aiIdea={state.aiIdea} aiTitle={state.aiTitle} aiSubtitle={state.aiSubtitle} aiOutline={state.aiOutline} aiBody={state.aiBody} aiExcerpt={state.aiExcerpt} aiError={state.aiError} isGenerating={isGenerating} isCreating={isCreating} onIdeaChange={(v) => dispatch({ type: 'SET_AI_IDEA', value: v })} onTitleChange={(v) => dispatch({ type: 'SET_AI_TITLE', value: v })} onSubtitleChange={(v) => dispatch({ type: 'SET_AI_SUBTITLE', value: v })} onOutlineChange={(v) => dispatch({ type: 'SET_AI_OUTLINE', value: v })} onBodyChange={(v) => dispatch({ type: 'SET_AI_BODY', value: v })} onExcerptChange={(v) => dispatch({ type: 'SET_AI_EXCERPT', value: v })} onErrorDismiss={() => dispatch({ type: 'SET_AI_ERROR', value: null })} onAddOutlineItem={() => dispatch({ type: 'SET_AI_OUTLINE', value: [...state.aiOutline, { id: outlineIdCounter.current++, value: '' }] })} />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {state.activeStep === 1 && state.method === 'template' && isAdmin && (
            <Button size="small" startIcon={<SettingsIcon />} onClick={() => { onClose(); navigate('/blogs/templates'); }}>
              {t('templates.manageTemplates')}
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={isCreating}>{t('common.actions.cancel')}</Button>
          {state.activeStep === 1 && (
            <Button onClick={handleBack} disabled={isCreating} data-testid="create-blog-wizard.btn.back">{t('common.actions.back')}</Button>
          )}
          {state.activeStep === 1 && state.method === 'scratch' && (
            <Button variant="contained" onClick={handleSubmit((data) => scratchMutation.mutate(data))} disabled={isCreating} data-testid="create-blog-wizard.btn.create">
              {isCreating ? t('blogs.wizard.creating') : t('blogs.wizard.create')}
            </Button>
          )}
          {state.activeStep === 1 && state.method === 'template' && (
            <Button variant="contained" onClick={handleTemplateConfirm} disabled={!state.selectedTemplate || isCreating}>
              {isCreating ? t('blogs.wizard.creating') : t('templates.useTemplate')}
            </Button>
          )}
          {state.activeStep === 1 && state.method === 'import' && state.importPhase === 'preview' && (
            <Button variant="contained" onClick={handleImportConfirm} disabled={isCreating || !state.importTitle.trim() || !state.importSlug.trim()}>
              {isCreating ? t('blogs.wizard.creating') : t('markdownImport.import')}
            </Button>
          )}
          {state.activeStep === 1 && state.method === 'ai' && state.aiPhase === 'idea' && (
            <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={handleAiGenerateOutline} disabled={isGenerating || !state.aiIdea.trim()}>
              {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generateOutline')}
            </Button>
          )}
          {state.activeStep === 1 && state.method === 'ai' && state.aiPhase === 'outline' && (
            <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={handleAiGeneratePost} disabled={isGenerating || !state.aiTitle.trim() || state.aiOutline.length === 0}>
              {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generatePost')}
            </Button>
          )}
          {state.activeStep === 1 && state.method === 'ai' && state.aiPhase === 'post' && (
            <Button variant="contained" onClick={() => aiMutation.mutate()} disabled={isCreating || !state.aiTitle.trim()}>
              {isCreating ? t('blogs.wizard.creating') : t('blogs.wizard.create')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
