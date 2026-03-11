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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CreateContentTemplateRequest } from '@/types/api';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import { blogTemplates } from '@/data/blogTemplates';
import TemplateWizardMethodStep from './TemplateWizardMethodStep';
import TemplateWizardScratchStep from './TemplateWizardScratchStep';
import TemplateWizardTemplateStep from './TemplateWizardTemplateStep';
import TemplateWizardImportStep from './TemplateWizardImportStep';

type CreationMethod = 'scratch' | 'template' | 'import';

const STEP_KEYS = ['contentTemplates.wizard.steps.method', 'contentTemplates.wizard.steps.details'] as const;

// --- Reducer ---

interface WizardState {
  activeStep: number;
  method: CreationMethod | null;
  // Template
  selectedTemplate: string | null;
  templateSearch: string;
  templatePage: number;
  // Import
  dragOver: boolean;
  importError: string | null;
  fileName: string;
  fileSize: number;
  parsed: MarkdownParseResult | null;
  // Scratch
  name: string;
  slugPrefix: string;
  body: string;
  // Import edit fields
  editName: string;
  editSlugPrefix: string;
  editBody: string;
}

type WizardAction =
  | { type: 'RESET' }
  | { type: 'SELECT_METHOD'; method: CreationMethod }
  | { type: 'GO_BACK' }
  | { type: 'SET_SELECTED_TEMPLATE'; value: string }
  | { type: 'SET_TEMPLATE_SEARCH'; value: string }
  | { type: 'SET_TEMPLATE_PAGE'; value: number }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IMPORT_ERROR'; value: string | null }
  | { type: 'SET_FILE_NAME'; value: string }
  | { type: 'SET_FILE_SIZE'; value: number }
  | { type: 'SET_PARSED'; result: MarkdownParseResult; editName: string; editSlugPrefix: string; editBody: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_SLUG_PREFIX'; value: string }
  | { type: 'SET_BODY'; value: string }
  | { type: 'SET_EDIT_NAME'; value: string }
  | { type: 'SET_EDIT_SLUG_PREFIX'; value: string };

const initialWizardState: WizardState = {
  activeStep: 0,
  method: null,
  selectedTemplate: null,
  templateSearch: '',
  templatePage: 0,
  dragOver: false,
  importError: null,
  fileName: '',
  fileSize: 0,
  parsed: null,
  name: '',
  slugPrefix: 'post',
  body: '',
  editName: '',
  editSlugPrefix: '',
  editBody: '',
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'RESET':
      return initialWizardState;
    case 'SELECT_METHOD':
      return { ...state, method: action.method, activeStep: 1 };
    case 'GO_BACK':
      return { ...state, activeStep: 0, method: null };
    case 'SET_SELECTED_TEMPLATE':
      return { ...state, selectedTemplate: action.value || null };
    case 'SET_TEMPLATE_SEARCH':
      return { ...state, templateSearch: action.value, templatePage: 0, selectedTemplate: null };
    case 'SET_TEMPLATE_PAGE':
      return { ...state, templatePage: action.value };
    case 'SET_DRAG_OVER':
      return { ...state, dragOver: action.value };
    case 'SET_IMPORT_ERROR':
      return { ...state, importError: action.value };
    case 'SET_FILE_NAME':
      return { ...state, fileName: action.value };
    case 'SET_FILE_SIZE':
      return { ...state, fileSize: action.value };
    case 'SET_PARSED':
      return { ...state, parsed: action.result, editName: action.editName, editSlugPrefix: action.editSlugPrefix, editBody: action.editBody };
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_SLUG_PREFIX':
      return { ...state, slugPrefix: action.value };
    case 'SET_BODY':
      return { ...state, body: action.value };
    case 'SET_EDIT_NAME':
      return { ...state, editName: action.value };
    case 'SET_EDIT_SLUG_PREFIX':
      return { ...state, editSlugPrefix: action.value };
  }
}

interface CreateTemplateWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateContentTemplateRequest) => void;
  loading?: boolean;
}

export default function CreateTemplateWizard({ open, onClose, onSubmit, loading }: CreateTemplateWizardProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  // Reset all state when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    dispatch({ type: 'RESET' });
  }
  prevOpenRef.current = open;

  // --- Confirm handlers ---
  const handleScratchSubmit = () => {
    if (!state.name.trim()) return;
    onSubmit({
      name: state.name.trim(),
      slug_prefix: state.slugPrefix || 'post',
      body: state.body || undefined,
      icon: 'Article',
      is_featured: false,
      allow_comments: true,
    });
  };

  const handleTemplateConfirm = () => {
    const tpl = blogTemplates.find((bt) => bt.id === state.selectedTemplate);
    if (!tpl) return;
    onSubmit({
      name: t(tpl.nameKey),
      description: t(tpl.descriptionKey),
      icon: tpl.icon,
      slug_prefix: tpl.defaults.slug,
      is_featured: tpl.defaults.is_featured,
      allow_comments: tpl.defaults.allow_comments,
      title: tpl.content.title,
      subtitle: tpl.content.subtitle,
      excerpt: tpl.content.excerpt,
      body: tpl.content.body,
      meta_title: tpl.content.meta_title,
      meta_description: tpl.content.meta_description,
    });
  };

  const handleImportConfirm = () => {
    if (!state.parsed || !state.editName.trim()) return;
    onSubmit({
      name: state.editName.trim(),
      slug_prefix: state.editSlugPrefix || 'post',
      body: state.editBody,
      title: state.parsed.title,
      excerpt: state.parsed.excerpt,
      meta_title: state.parsed.meta_title,
      icon: 'Article',
      is_featured: false,
      allow_comments: true,
    });
  };

  const handleParsed = (result: MarkdownParseResult) => {
    dispatch({
      type: 'SET_PARSED',
      result,
      editName: result.title,
      editSlugPrefix: result.slug.replace(/-\d+$/, ''),
      editBody: result.body,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={state.method === 'template' ? 'md' : 'sm'} fullWidth aria-labelledby="create-template-wizard-title" data-testid="create-template-wizard">
      <DialogTitle id="create-template-wizard-title">{t('contentTemplates.wizard.title')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={state.activeStep} sx={{ mb: 3, mt: 1 }}>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {state.activeStep === 0 && (
          <TemplateWizardMethodStep
            method={state.method}
            onSelect={(m) => dispatch({ type: 'SELECT_METHOD', method: m })}
          />
        )}

        {state.activeStep === 1 && state.method === 'scratch' && (
          <TemplateWizardScratchStep
            name={state.name}
            slugPrefix={state.slugPrefix}
            body={state.body}
            onNameChange={(v) => dispatch({ type: 'SET_NAME', value: v })}
            onSlugPrefixChange={(v) => dispatch({ type: 'SET_SLUG_PREFIX', value: v })}
            onBodyChange={(v) => dispatch({ type: 'SET_BODY', value: v })}
          />
        )}

        {state.activeStep === 1 && state.method === 'template' && (
          <TemplateWizardTemplateStep
            selectedTemplate={state.selectedTemplate}
            onSelectTemplate={(v) => dispatch({ type: 'SET_SELECTED_TEMPLATE', value: v })}
            templateSearch={state.templateSearch}
            onSearchChange={(v) => dispatch({ type: 'SET_TEMPLATE_SEARCH', value: v })}
            templatePage={state.templatePage}
            onPageChange={(v) => dispatch({ type: 'SET_TEMPLATE_PAGE', value: v })}
          />
        )}

        {state.activeStep === 1 && state.method === 'import' && (
          <TemplateWizardImportStep
            parsed={state.parsed}
            editName={state.editName}
            editSlugPrefix={state.editSlugPrefix}
            editBody={state.editBody}
            importError={state.importError}
            fileName={state.fileName}
            dragOver={state.dragOver}
            fileSize={state.fileSize}
            onParsed={handleParsed}
            onEditNameChange={(v) => dispatch({ type: 'SET_EDIT_NAME', value: v })}
            onEditSlugPrefixChange={(v) => dispatch({ type: 'SET_EDIT_SLUG_PREFIX', value: v })}
            onImportError={(v) => dispatch({ type: 'SET_IMPORT_ERROR', value: v })}
            onFileName={(v) => dispatch({ type: 'SET_FILE_NAME', value: v })}
            onFileSize={(v) => dispatch({ type: 'SET_FILE_SIZE', value: v })}
            onDragOver={(v) => dispatch({ type: 'SET_DRAG_OVER', value: v })}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          {state.activeStep === 1 && (
            <Button onClick={() => dispatch({ type: 'GO_BACK' })} disabled={loading}>{t('common.actions.back')}</Button>
          )}

          {state.activeStep === 1 && state.method === 'scratch' && (
            <Button variant="contained" onClick={handleScratchSubmit} disabled={!state.name.trim() || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}

          {state.activeStep === 1 && state.method === 'template' && (
            <Button variant="contained" onClick={handleTemplateConfirm} disabled={!state.selectedTemplate || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}

          {state.activeStep === 1 && state.method === 'import' && state.parsed && (
            <Button variant="contained" onClick={handleImportConfirm} disabled={!state.editName.trim() || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
