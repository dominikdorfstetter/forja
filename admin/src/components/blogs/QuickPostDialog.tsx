import { useState, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  TextField,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugify } from '@/utils/slugify';
import type { ContentStatus } from '@/types/api';

interface QuickPostDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickPostDialog({ open, onClose }: QuickPostDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { userFullName } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const { data: siteLocales } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const resetForm = useCallback(() => {
    setTitle('');
    setBody('');
    setMenuOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

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
    // Navigate to full editor — create as draft first, then redirect
    publishMutation.mutate('Draft');
  };

  const isSaving = publishMutation.isPending;
  const canSubmit = title.trim().length > 0;

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
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
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
      </DialogActions>
    </Dialog>
  );
}
