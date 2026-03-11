import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAiAssist } from '@/hooks/useAiAssist';
import { slugify } from '@/utils/slugify';
import type { ContentStatus } from '@/types/api';

interface QuickPostDialogProps {
  open: boolean;
  onClose: () => void;
}

type DialogMode = 'manual' | 'ai';
type AiStep = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };

export default function QuickPostDialog({ open, onClose }: QuickPostDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { userFullName } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const { isConfigured: aiAvailable, generate: aiGenerate, isGenerating } = useAiAssist();

  // Shared state
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // AI-specific state
  const [mode, setMode] = useState<DialogMode>('manual');
  const [aiStep, setAiStep] = useState<AiStep>('idea');
  const [idea, setIdea] = useState('');
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const outlineIdCounter = useRef(0);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data: siteLocales } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const resetForm = useCallback(() => {
    setTitle('');
    setSubtitle('');
    setBody('');
    setMenuOpen(false);
    setIdea('');
    setOutline([]);
    setAiStep('idea');
    setAiError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    setMode('manual');
    onClose();
  }, [resetForm, onClose]);

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: DialogMode | null) => {
    if (newMode) {
      setMode(newMode);
      if (newMode === 'ai') {
        setAiStep('idea');
      }
    }
  };

  // ── AI Step Handlers ──────────────────────────────────────────

  const handleGenerateOutline = async () => {
    setAiError(null);
    try {
      const result = await aiGenerate('draft_outline', idea);
      if (result.title) setTitle(result.title);
      if (result.subtitle) setSubtitle(result.subtitle);
      if (result.outline) setOutline(result.outline.map((v: string) => ({ id: outlineIdCounter.current++, value: v })));
      setAiStep('outline');
    } catch {
      setAiError(t('quickPost.ai.outlineError'));
    }
  };

  const handleGeneratePost = async () => {
    setAiError(null);
    const content = JSON.stringify({
      title,
      subtitle,
      outline: outline.map(item => item.value),
    });
    try {
      const result = await aiGenerate('draft_post', content);
      if (result.body) setBody(result.body);
      setAiStep('post');
    } catch {
      setAiError(t('quickPost.ai.postError'));
    }
  };

  const handleRemoveOutlineItem = (id: number) => {
    setOutline((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditOutlineItem = (id: number, value: string) => {
    setOutline((prev) => prev.map((item) => (item.id === id ? { ...item, value } : item)));
  };

  const handleAddOutlineItem = () => {
    setOutline((prev) => [...prev, { id: outlineIdCounter.current++, value: '' }]);
  };

  const handleRegenerateOutline = async () => {
    setAiStep('idea');
    setOutline([]);
    setTitle('');
    setSubtitle('');
  };

  // ── Publish ───────────────────────────────────────────────────

  const publishMutation = useMutation({
    mutationFn: async (status: ContentStatus) => {
      const slug = slugify(title) || `post-${Date.now()}`;
      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: false,
        status,
        site_ids: [selectedSiteId],
      });

      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title,
          subtitle: subtitle || undefined,
          body: body || undefined,
        });
      }

      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('quickPost.success'));
      handleClose();
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
  });

  const handlePublish = () => publishMutation.mutate('Published');
  const handleSaveAsDraft = () => publishMutation.mutate('Draft');

  const handleMoreOptions = () => {
    publishMutation.mutate('Draft');
  };

  const isSaving = publishMutation.isPending;
  const canSubmit = title.trim().length > 0;
  const isManualReady = mode === 'manual';
  const isAiPostReady = mode === 'ai' && aiStep === 'post';
  const showPublishActions = isManualReady || isAiPostReady;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="quick-post-title"
      data-testid="quick-post.dialog"
    >
      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={2}>
          {/* Mode toggle — only show if AI is available */}
          {aiAvailable && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={handleModeChange}
                size="small"
              >
                <ToggleButton value="manual" aria-label={t('quickPost.ai.manualMode')}>
                  <EditIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('quickPost.ai.manualMode')}
                </ToggleButton>
                <ToggleButton value="ai" aria-label={t('quickPost.ai.aiMode')}>
                  <AutoAwesomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('quickPost.ai.aiMode')}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Loading indicator */}
          {isGenerating && <LinearProgress />}

          {/* Error display */}
          {aiError && (
            <Alert severity="error" onClose={() => setAiError(null)}>
              {aiError}
            </Alert>
          )}

          {/* ── Manual Mode ── */}
          {mode === 'manual' && (
            <>
              <TextField
                id="quick-post-title"
                placeholder={t('quickPost.titlePlaceholder')}
                fullWidth
                variant="standard"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
                autoFocus
                slotProps={{
                  input: {
                    sx: { fontSize: '1.5rem', fontWeight: 600 },
                    disableUnderline: true,
                  },
                }}
              />
              <ForjaEditor
                value={body}
                onChange={setBody}
                height={300}
                placeholder={t('quickPost.bodyPlaceholder')}
                siteId={selectedSiteId}
              />
            </>
          )}

          {/* ── AI Mode: Step 1 — Idea Input ── */}
          {mode === 'ai' && aiStep === 'idea' && (
            <>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('quickPost.ai.ideaTitle')}
              </Typography>
              <TextField
                placeholder={t('quickPost.ai.ideaPlaceholder')}
                fullWidth
                multiline
                minRows={3}
                maxRows={8}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                disabled={isGenerating}
                autoFocus
              />
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerateOutline}
                disabled={isGenerating || !idea.trim()}
              >
                {isGenerating
                  ? t('quickPost.ai.generating')
                  : t('quickPost.ai.generateOutline')}
              </Button>
            </>
          )}

          {/* ── AI Mode: Step 2 — Outline Review ── */}
          {mode === 'ai' && aiStep === 'outline' && (
            <>
              <TextField
                label={t('quickPost.ai.titleLabel')}
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGenerating}
              />
              <TextField
                label={t('quickPost.ai.subtitleLabel')}
                fullWidth
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                disabled={isGenerating}
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('quickPost.ai.outlineLabel')}
                </Typography>
                <Stack spacing={1}>
                  {outline.map((item, index) => (
                    <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                      <Chip label={index + 1} size="small" variant="outlined" />
                      <TextField
                        fullWidth
                        size="small"
                        value={item.value}
                        onChange={(e) => handleEditOutlineItem(item.id, e.target.value)}
                        disabled={isGenerating}
                      />
                      <Tooltip title={t('common.actions.delete')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveOutlineItem(item.id)}
                          disabled={isGenerating}
                          aria-label={t('common.actions.delete')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    onClick={handleAddOutlineItem}
                    disabled={isGenerating}
                  >
                    {t('quickPost.ai.addPoint')}
                  </Button>
                </Stack>
              </Box>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title={t('quickPost.ai.regenerateOutline')} arrow>
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={handleRegenerateOutline}
                    disabled={isGenerating}
                    aria-label={t('quickPost.ai.regenerateOutline')}
                  >
                    {t('quickPost.ai.startOver')}
                  </Button>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleGeneratePost}
                  disabled={isGenerating || !title.trim() || outline.length === 0}
                >
                  {isGenerating
                    ? t('quickPost.ai.generating')
                    : t('quickPost.ai.generatePost')}
                </Button>
              </Stack>
            </>
          )}

          {/* ── AI Mode: Step 3 — Post Review & Edit ── */}
          {mode === 'ai' && aiStep === 'post' && (
            <>
              <TextField
                label={t('quickPost.ai.titleLabel')}
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
              />
              <ForjaEditor
                value={body}
                onChange={setBody}
                height={300}
                placeholder={t('quickPost.bodyPlaceholder')}
                siteId={selectedSiteId}
              />
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        {showPublishActions ? (
          <>
            <Button
              startIcon={<OpenInNewIcon />}
              onClick={handleMoreOptions}
              disabled={isSaving || !canSubmit}
              size="small"
            >
              {t('quickPost.moreOptions')}
            </Button>

            <Stack direction="row" spacing={1}>
              <Button onClick={handleClose} disabled={isSaving}>
                {t('common.actions.cancel')}
              </Button>

              <ButtonGroup variant="contained" ref={anchorRef} disabled={isSaving || !canSubmit}>
                <Button onClick={handlePublish} startIcon={<SendIcon />}>
                  {isSaving ? t('common.actions.saving') : t('quickPost.publish')}
                </Button>
                <Button size="small" onClick={() => setMenuOpen((prev) => !prev)}>
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>

              <Popper open={menuOpen} anchorEl={anchorRef.current} transition disablePortal placement="top-end">
                {({ TransitionProps }) => (
                  <Grow {...TransitionProps}>
                    <Paper elevation={8}>
                      <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
                        <MenuList>
                          <MenuItem onClick={handlePublish}>
                            {t('quickPost.publishNow')}
                          </MenuItem>
                          <MenuItem onClick={handleSaveAsDraft}>
                            {t('quickPost.saveAsDraft')}
                          </MenuItem>
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
            <Button onClick={handleClose} disabled={isGenerating}>
              {t('common.actions.cancel')}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
}
