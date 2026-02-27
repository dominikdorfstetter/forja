import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ReviewCommentDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (comment?: string) => void;
  loading?: boolean;
}

export default function ReviewCommentDialog({
  open,
  title,
  onClose,
  onSubmit,
  loading,
}: ReviewCommentDialogProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit(comment.trim() || undefined);
    setComment('');
  };

  const handleClose = () => {
    setComment('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          label={t('workflow.reviewComment')}
          placeholder={t('workflow.reviewCommentPlaceholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.actions.cancel')}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? t('common.actions.saving') : t('common.actions.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
