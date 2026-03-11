import { useCallback, useReducer, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  Grow,
  IconButton,
  LinearProgress,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import { useSiteContext } from '@/store/SiteContext';
import { useAiAssist } from '@/hooks/useAiAssist';
import { useQuickPostPublish } from './useQuickPostPublish';
import type { RegenerateField } from './BlogWizardAiStep';

interface QuickPostDialogProps {
  open: boolean;
  onClose: () => void;
}

type DialogMode = 'manual' | 'ai';
type AiStep = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };

const MAX = {
  title: 500,
  subtitle: 500,
  excerpt: 300,
  metaTitle: 60,
  metaDescription: 160,
} as const;

function charCounter(value: string, max: number) {
  const ratio = value.length / max;
  return {
    text: `${value.length} / ${max}`,
    color: ratio > 0.9 ? 'error.main' : 'text.secondary',
  };
}

// --- Reducer ---

interface QuickPostState {
  title: string;
  subtitle: string;
  body: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  menuOpen: boolean;
  mode: DialogMode;
  aiStep: AiStep;
  idea: string;
  outline: OutlineItem[];
  aiError: string | null;
}

type QuickPostAction =
  | { type: 'RESET' }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_SUBTITLE'; value: string }
  | { type: 'SET_BODY'; value: string }
  | { type: 'SET_EXCERPT'; value: string }
  | { type: 'SET_META_TITLE'; value: string }
  | { type: 'SET_META_DESCRIPTION'; value: string }
  | { type: 'SET_MENU_OPEN'; value: boolean }
  | { type: 'SET_MODE'; value: DialogMode }
  | { type: 'SET_AI_STEP'; value: AiStep }
  | { type: 'SET_IDEA'; value: string }
  | { type: 'SET_OUTLINE'; value: OutlineItem[] }
  | { type: 'SET_AI_ERROR'; value: string | null }
  | { type: 'OUTLINE_GENERATED'; title: string; subtitle: string; outline: OutlineItem[] }
  | { type: 'POST_GENERATED'; body: string; excerpt: string; metaTitle: string; metaDescription: string }
  | { type: 'REGENERATE_OUTLINE' };

const initialState: QuickPostState = {
  title: '', subtitle: '', body: '', excerpt: '', metaTitle: '', metaDescription: '',
  menuOpen: false, mode: 'manual', aiStep: 'idea', idea: '', outline: [], aiError: null,
};

function reducer(state: QuickPostState, action: QuickPostAction): QuickPostState {
  switch (action.type) {
    case 'RESET': return { ...initialState, mode: state.mode };
    case 'SET_TITLE': return { ...state, title: action.value };
    case 'SET_SUBTITLE': return { ...state, subtitle: action.value };
    case 'SET_BODY': return { ...state, body: action.value };
    case 'SET_EXCERPT': return { ...state, excerpt: action.value };
    case 'SET_META_TITLE': return { ...state, metaTitle: action.value };
    case 'SET_META_DESCRIPTION': return { ...state, metaDescription: action.value };
    case 'SET_MENU_OPEN': return { ...state, menuOpen: action.value };
    case 'SET_MODE': return { ...state, mode: action.value, aiStep: action.value === 'ai' ? 'idea' : state.aiStep };
    case 'SET_AI_STEP': return { ...state, aiStep: action.value };
    case 'SET_IDEA': return { ...state, idea: action.value };
    case 'SET_OUTLINE': return { ...state, outline: action.value };
    case 'SET_AI_ERROR': return { ...state, aiError: action.value };
    case 'OUTLINE_GENERATED': return { ...state, title: action.title || state.title, subtitle: action.subtitle || state.subtitle, outline: action.outline, aiStep: 'outline', aiError: null };
    case 'POST_GENERATED': return { ...state, body: action.body || state.body, excerpt: action.excerpt || state.excerpt, metaTitle: action.metaTitle || state.metaTitle, metaDescription: action.metaDescription || state.metaDescription, aiStep: 'post', aiError: null };
    case 'REGENERATE_OUTLINE': return { ...state, aiStep: 'idea', outline: [], title: '', subtitle: '' };
  }
}

export default function QuickPostDialog({ open, onClose }: QuickPostDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { isConfigured: aiAvailable, generate: aiGenerate, isGenerating } = useAiAssist();

  const [state, dispatch] = useReducer(reducer, initialState);
  const [regeneratingField, setRegeneratingField] = useState<RegenerateField | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const outlineIdCounter = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET' });
    outlineIdCounter.current = 0;
    setRegeneratingField(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    dispatch({ type: 'SET_MODE', value: 'manual' });
    onClose();
  }, [resetForm, onClose]);

  const publishMutation = useQuickPostPublish({
    open,
    getPostData: () => stateRef.current,
    onClose: handleClose,
  });

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: DialogMode | null) => {
    if (newMode) dispatch({ type: 'SET_MODE', value: newMode });
  };

  const handleGenerateOutline = async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    try {
      const result = await aiGenerate('draft_outline', state.idea);
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

  const handleGeneratePost = async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    const content = JSON.stringify({ title: state.title, subtitle: state.subtitle, outline: state.outline.map(item => item.value) });
    try {
      const result = await aiGenerate('draft_post', content);
      dispatch({ type: 'POST_GENERATED', body: result.body || '', excerpt: result.excerpt || '', metaTitle: result.meta_title || '', metaDescription: result.meta_description || '' });
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.postError') });
    }
  };

  const handleRegenerate = useCallback(async (field: RegenerateField) => {
    const s = stateRef.current;
    dispatch({ type: 'SET_AI_ERROR', value: null });
    setRegeneratingField(field);
    try {
      if (field === 'all') {
        const content = JSON.stringify({ title: s.title, subtitle: s.subtitle, outline: s.outline.map(item => item.value) });
        const result = await aiGenerate('draft_post', content);
        if (result.body) dispatch({ type: 'SET_BODY', value: result.body });
        if (result.excerpt) dispatch({ type: 'SET_EXCERPT', value: result.excerpt });
        if (result.meta_title) dispatch({ type: 'SET_META_TITLE', value: result.meta_title });
        if (result.meta_description) dispatch({ type: 'SET_META_DESCRIPTION', value: result.meta_description });
      } else if (field === 'body') {
        const content = JSON.stringify({ title: s.title, subtitle: s.subtitle, outline: s.outline.map(item => item.value) });
        const result = await aiGenerate('draft_post', content);
        if (result.body) dispatch({ type: 'SET_BODY', value: result.body });
      } else if (field === 'excerpt') {
        const result = await aiGenerate('excerpt', s.body);
        if (result.excerpt) dispatch({ type: 'SET_EXCERPT', value: result.excerpt });
      } else if (field === 'seo') {
        const result = await aiGenerate('seo', s.body);
        if (result.meta_title) dispatch({ type: 'SET_META_TITLE', value: result.meta_title });
        if (result.meta_description) dispatch({ type: 'SET_META_DESCRIPTION', value: result.meta_description });
      }
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.regenerateError', 'Regeneration failed. Please try again.') });
    } finally {
      setRegeneratingField(null);
    }
  }, [aiGenerate, t]);

  const isSaving = publishMutation.isPending;
  const busy = isSaving || isGenerating || !!regeneratingField;
  const canSubmit = state.title.trim().length > 0;
  const showPublishActions = state.mode === 'manual' || (state.mode === 'ai' && state.aiStep === 'post');

  const regenButton = (field: RegenerateField, loading: boolean) => (
    <Tooltip title={t('quickPost.ai.regenerate', 'Regenerate')} arrow>
      <span>
        <IconButton size="small" onClick={() => handleRegenerate(field)} disabled={busy} aria-label={t('quickPost.ai.regenerate', 'Regenerate')}>
          {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth aria-labelledby="quick-post-title" data-testid="quick-post.dialog">
      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={2}>
          {aiAvailable && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup value={state.mode} exclusive onChange={handleModeChange} size="small">
                <ToggleButton value="manual" aria-label={t('quickPost.ai.manualMode')}>
                  <EditIcon sx={{ mr: 0.5 }} fontSize="small" />{t('quickPost.ai.manualMode')}
                </ToggleButton>
                <ToggleButton value="ai" aria-label={t('quickPost.ai.aiMode')}>
                  <AutoAwesomeIcon sx={{ mr: 0.5 }} fontSize="small" />{t('quickPost.ai.aiMode')}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {(isGenerating || regeneratingField === 'all') && <LinearProgress />}
          {state.aiError && <Alert severity="error" onClose={() => dispatch({ type: 'SET_AI_ERROR', value: null })}>{state.aiError}</Alert>}

          {state.mode === 'manual' && (
            <>
              <TextField id="quick-post-title" placeholder={t('quickPost.titlePlaceholder')} fullWidth variant="standard" value={state.title} onChange={(e) => dispatch({ type: 'SET_TITLE', value: e.target.value })} disabled={isSaving} autoFocus slotProps={{ htmlInput: { maxLength: MAX.title }, input: { sx: { fontSize: '1.5rem', fontWeight: 600 }, disableUnderline: true } }} />
              <ForjaEditor value={state.body} onChange={(val) => dispatch({ type: 'SET_BODY', value: val })} height={300} placeholder={t('quickPost.bodyPlaceholder')} siteId={selectedSiteId} />
            </>
          )}

          {state.mode === 'ai' && state.aiStep === 'idea' && (
            <>
              <Typography variant="subtitle1" fontWeight={600}>{t('quickPost.ai.ideaTitle')}</Typography>
              <TextField placeholder={t('quickPost.ai.ideaPlaceholder')} fullWidth multiline minRows={3} maxRows={8} value={state.idea} onChange={(e) => dispatch({ type: 'SET_IDEA', value: e.target.value })} disabled={isGenerating} autoFocus />
              <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={handleGenerateOutline} disabled={isGenerating || !state.idea.trim()}>
                {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generateOutline')}
              </Button>
            </>
          )}

          {state.mode === 'ai' && state.aiStep === 'outline' && (
            <>
              <TextField label={t('quickPost.ai.titleLabel')} fullWidth value={state.title} onChange={(e) => dispatch({ type: 'SET_TITLE', value: e.target.value })} disabled={isGenerating} slotProps={{ htmlInput: { maxLength: MAX.title } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.title, MAX.title).color }}>{charCounter(state.title, MAX.title).text}</Typography>} />
              <TextField label={t('quickPost.ai.subtitleLabel')} fullWidth value={state.subtitle} onChange={(e) => dispatch({ type: 'SET_SUBTITLE', value: e.target.value })} disabled={isGenerating} slotProps={{ htmlInput: { maxLength: MAX.subtitle } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.subtitle, MAX.subtitle).color }}>{charCounter(state.subtitle, MAX.subtitle).text}</Typography>} />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('quickPost.ai.outlineLabel')}</Typography>
                <Stack spacing={1}>
                  {state.outline.map((item, index) => (
                    <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                      <Chip label={index + 1} size="small" variant="outlined" />
                      <TextField fullWidth size="small" multiline maxRows={4} value={item.value} onChange={(e) => dispatch({ type: 'SET_OUTLINE', value: state.outline.map((v) => (v.id === item.id ? { ...v, value: e.target.value } : v)) })} disabled={isGenerating} />
                      <Tooltip title={t('common.actions.delete')} arrow>
                        <IconButton size="small" onClick={() => dispatch({ type: 'SET_OUTLINE', value: state.outline.filter((v) => v.id !== item.id) })} disabled={isGenerating} aria-label={t('common.actions.delete')}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                  <Button size="small" onClick={() => dispatch({ type: 'SET_OUTLINE', value: [...state.outline, { id: outlineIdCounter.current++, value: '' }] })} disabled={isGenerating}>{t('quickPost.ai.addPoint')}</Button>
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title={t('quickPost.ai.regenerateOutline')} arrow>
                  <Button startIcon={<RefreshIcon />} onClick={() => dispatch({ type: 'REGENERATE_OUTLINE' })} disabled={isGenerating} aria-label={t('quickPost.ai.regenerateOutline')}>{t('quickPost.ai.startOver')}</Button>
                </Tooltip>
                <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={handleGeneratePost} disabled={isGenerating || !state.title.trim() || state.outline.length === 0}>
                  {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generatePost')}
                </Button>
              </Stack>
            </>
          )}

          {state.mode === 'ai' && state.aiStep === 'post' && (
            <>
              <TextField label={t('quickPost.ai.titleLabel')} fullWidth value={state.title} onChange={(e) => dispatch({ type: 'SET_TITLE', value: e.target.value })} disabled={busy} slotProps={{ htmlInput: { maxLength: MAX.title } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.title, MAX.title).color }}>{charCounter(state.title, MAX.title).text}</Typography>} />

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.body')}</Typography>
                  {regenButton('body', regeneratingField === 'body')}
                </Stack>
                <ForjaEditor value={state.body} onChange={(val) => dispatch({ type: 'SET_BODY', value: val })} height={300} placeholder={t('quickPost.bodyPlaceholder')} siteId={selectedSiteId} />
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.excerpt')}</Typography>
                  {regenButton('excerpt', regeneratingField === 'excerpt')}
                </Stack>
                <TextField fullWidth multiline rows={2} value={state.excerpt} onChange={(e) => dispatch({ type: 'SET_EXCERPT', value: e.target.value })} disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'seo'} slotProps={{ htmlInput: { maxLength: MAX.excerpt } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.excerpt, MAX.excerpt).color }}>{charCounter(state.excerpt, MAX.excerpt).text}</Typography>} />
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.seo', 'SEO')}</Typography>
                  {regenButton('seo', regeneratingField === 'seo')}
                </Stack>
                <Stack spacing={2}>
                  <TextField label={t('blogDetail.fields.metaTitle')} fullWidth value={state.metaTitle} onChange={(e) => dispatch({ type: 'SET_META_TITLE', value: e.target.value })} disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'excerpt'} slotProps={{ htmlInput: { maxLength: MAX.metaTitle } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.metaTitle, MAX.metaTitle).color }}>{charCounter(state.metaTitle, MAX.metaTitle).text}</Typography>} />
                  <TextField label={t('blogDetail.fields.metaDescription')} fullWidth multiline rows={2} value={state.metaDescription} onChange={(e) => dispatch({ type: 'SET_META_DESCRIPTION', value: e.target.value })} disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'excerpt'} slotProps={{ htmlInput: { maxLength: MAX.metaDescription } }} helperText={<Typography variant="caption" sx={{ color: charCounter(state.metaDescription, MAX.metaDescription).color }}>{charCounter(state.metaDescription, MAX.metaDescription).text}</Typography>} />
                </Stack>
              </Box>

              <Button variant="outlined" size="small" startIcon={regeneratingField === 'all' ? <CircularProgress size={16} /> : <AutoAwesomeIcon />} onClick={() => handleRegenerate('all')} disabled={busy}>
                {t('quickPost.ai.regenerateAll', 'Regenerate All')}
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        {showPublishActions ? (
          <>
            <Button startIcon={<OpenInNewIcon />} onClick={() => publishMutation.mutate('Draft')} disabled={isSaving || !canSubmit} size="small">{t('quickPost.moreOptions')}</Button>
            <Stack direction="row" spacing={1}>
              <Button onClick={handleClose} disabled={isSaving}>{t('common.actions.cancel')}</Button>
              <ButtonGroup variant="contained" ref={anchorRef} disabled={isSaving || !canSubmit}>
                <Button onClick={() => publishMutation.mutate('Published')} startIcon={<SendIcon />}>{isSaving ? t('common.actions.saving') : t('quickPost.publish')}</Button>
                <Button size="small" onClick={() => dispatch({ type: 'SET_MENU_OPEN', value: !state.menuOpen })}><ArrowDropDownIcon /></Button>
              </ButtonGroup>
              <Popper open={state.menuOpen} anchorEl={anchorRef.current} transition disablePortal placement="top-end">
                {({ TransitionProps }) => (
                  <Grow {...TransitionProps}>
                    <Paper elevation={8}>
                      <ClickAwayListener onClickAway={() => dispatch({ type: 'SET_MENU_OPEN', value: false })}>
                        <MenuList>
                          <MenuItem onClick={() => publishMutation.mutate('Published')}>{t('quickPost.publishNow')}</MenuItem>
                          <MenuItem onClick={() => publishMutation.mutate('Draft')}>{t('quickPost.saveAsDraft')}</MenuItem>
                        </MenuList>
                      </ClickAwayListener>
                    </Paper>
                  </Grow>
                )}
              </Popper>
            </Stack>
          </>
        ) : (
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose} disabled={isGenerating}>{t('common.actions.cancel')}</Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
}
