import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import { useSiteContext } from '@/store/SiteContext';
import { useQuickPostPublish } from './useQuickPostPublish';
import { useQuickPostAi } from './useQuickPostAi';
import QuickPostActions from './QuickPostActions';
import QuickPostIdeaStep from './QuickPostIdeaStep';
import QuickPostOutlineStep from './QuickPostOutlineStep';
import QuickPostPostStep from './QuickPostPostStep';
import {
  initialQuickPostState,
  quickPostReducer,
  quickPostView,
  showsPublishActions,
  type DialogMode,
} from './quickPostState';
import { MAX } from './blogWizardAiFields';

interface QuickPostDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickPostDialog({ open, onClose }: QuickPostDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  const [state, dispatch] = useReducer(quickPostReducer, initialQuickPostState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const ai = useQuickPostAi(stateRef, dispatch);
  const { isGenerating, regeneratingField, reset: resetAi } = ai;

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET' });
    resetAi();
  }, [resetAi]);

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

  const isSaving = publishMutation.isPending;
  const busy = isSaving || isGenerating || !!regeneratingField;
  const view = quickPostView(state);

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      icon="edit_note"
      title={t('quickPost.title', 'Quick post')}
      maxWidth="md"
      data-testid="quick-post.dialog"
      actions={
        showsPublishActions(view) ? (
          <QuickPostActions
            isSaving={isSaving}
            canSubmit={state.title.trim().length > 0}
            menuOpen={state.menuOpen}
            onMenuOpenChange={(value) => dispatch({ type: 'SET_MENU_OPEN', value })}
            onPublish={(status) => publishMutation.mutate(status)}
            onCancel={handleClose}
          />
        ) : (
          <Button onClick={handleClose} disabled={isGenerating}>{t('common.actions.cancel')}</Button>
        )
      }
    >
        <Stack spacing={2}>
          {ai.aiAvailable && (
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

          {view === 'manual' && (
            <>
              <TextField id="quick-post-title" placeholder={t('quickPost.titlePlaceholder')} fullWidth variant="standard" value={state.title} onChange={(e) => dispatch({ type: 'SET_TITLE', value: e.target.value })} disabled={isSaving} autoFocus slotProps={{ htmlInput: { maxLength: MAX.title }, input: { sx: { fontSize: '1.5rem', fontWeight: 600 }, disableUnderline: true } }} />
              <ForjaEditor value={state.body} onChange={(val) => dispatch({ type: 'SET_BODY', value: val })} height={300} placeholder={t('quickPost.bodyPlaceholder')} siteId={selectedSiteId} />
            </>
          )}

          {view === 'idea' && <QuickPostIdeaStep idea={state.idea} dispatch={dispatch} ai={ai} />}
          {view === 'outline' && <QuickPostOutlineStep state={state} dispatch={dispatch} ai={ai} />}
          {view === 'post' && <QuickPostPostStep state={state} dispatch={dispatch} ai={ai} busy={busy} siteId={selectedSiteId} />}
        </Stack>
    </FormDialog>
  );
}
