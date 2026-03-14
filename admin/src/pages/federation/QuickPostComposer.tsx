import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import type { FederationNote } from '@/types/api';

interface QuickPostComposerProps {
  siteId: string;
}

const MAX_CHARS = 500;

export default function QuickPostComposer({ siteId }: QuickPostComposerProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FederationNote | null>(null);

  const { data: notesData } = useQuery({
    queryKey: ['federation-notes', siteId],
    queryFn: () => apiService.getFederationNotes(siteId, { page: 1, page_size: 5 }),
    enabled: !!siteId,
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => apiService.createFederationNote(siteId, { body }),
    onSuccess: () => {
      setText('');
      enqueueSnackbar(t('federation.quickPost.posted'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-stats', siteId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => apiService.deleteFederationNote(siteId, noteId),
    onSuccess: () => {
      setDeleteTarget(null);
      enqueueSnackbar(t('federation.quickPost.deleted'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-stats', siteId] });
    },
  });

  const handlePost = () => {
    if (!text.trim()) return;
    createMutation.mutate(text);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const notes = notesData?.data ?? [];

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {t('federation.quickPost.title')}
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder={t('federation.quickPost.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_CHARS } }}
            sx={{ mt: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('federation.quickPost.charCount', { count: text.length })}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={handlePost}
              disabled={!text.trim() || createMutation.isPending}
            >
              {createMutation.isPending
                ? t('federation.quickPost.posting')
                : t('federation.quickPost.post')}
            </Button>
          </Box>

          {notes.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {t('federation.quickPost.recentPosts')}
              </Typography>
              {notes.map((note) => (
                <Box
                  key={note.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    py: 1,
                    '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' },
                  }}
                >
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2">{note.body}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(note.published_at)}
                    </Typography>
                  </Box>
                  <Tooltip title={t('federation.quickPost.deleteConfirm')}>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(note)}
                      aria-label={t('federation.quickPost.deleteConfirm')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </>
          )}

          {notes.length === 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {t('federation.quickPost.noPosts')}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('federation.quickPost.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('federation.quickPost.deleteMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            disabled={deleteMutation.isPending}
          >
            {t('federation.quickPost.deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
