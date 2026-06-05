import { useState } from 'react';
import { TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';

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
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      icon="rate_review"
      title={title}
      submitLabel={t('common.actions.submit')}
      submitTestId="review-comment.btn.submit"
      cancelTestId="review-comment.btn.cancel"
      loading={loading}
      data-testid="review-comment.dialog"
    >
      <TextField
        autoFocus
        multiline
        minRows={3}
        maxRows={6}
        fullWidth
        size="small"
        label={t('workflow.reviewComment')}
        placeholder={t('workflow.reviewCommentPlaceholder')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
    </FormDialog>
  );
}
