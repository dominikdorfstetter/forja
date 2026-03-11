import { Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import UndoIcon from '@mui/icons-material/Undo';
import { useTranslation } from 'react-i18next';

interface WorkflowActionsProps {
  currentStatus: string;
  isSaving: boolean;
  canSubmitForReview?: boolean;
  canApprove?: boolean;
  canRequestChanges?: boolean;
  canPublish?: boolean;
  canUnpublish?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  onSubmitForReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}

export default function WorkflowActions({
  currentStatus,
  isSaving,
  canSubmitForReview,
  canApprove,
  canRequestChanges,
  canPublish,
  canUnpublish,
  canArchive,
  canRestore,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
}: WorkflowActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {canRequestChanges && currentStatus === 'InReview' && onRequestChanges && (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<UndoIcon />}
          onClick={onRequestChanges}
          disabled={isSaving}
        >
          {t('workflow.requestChanges')}
        </Button>
      )}
      {canUnpublish && onUnpublish && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<UnpublishedIcon />}
          onClick={onUnpublish}
          disabled={isSaving}
        >
          {t('workflow.unpublish')}
        </Button>
      )}
      {canArchive && onArchive && (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<ArchiveIcon />}
          onClick={onArchive}
          disabled={isSaving}
        >
          {t('workflow.archive')}
        </Button>
      )}
      {canRestore && onRestore && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<UnarchiveIcon />}
          onClick={onRestore}
          disabled={isSaving}
        >
          {t('workflow.restore')}
        </Button>
      )}
      {canSubmitForReview && currentStatus === 'Draft' && onSubmitForReview && (
        <Button
          size="small"
          variant="contained"
          color="info"
          startIcon={<SendIcon />}
          onClick={onSubmitForReview}
          disabled={isSaving}
        >
          {t('workflow.submitForReview')}
        </Button>
      )}
      {canApprove && currentStatus === 'InReview' && onApprove && (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<CheckCircleIcon />}
          onClick={onApprove}
          disabled={isSaving}
        >
          {t('workflow.approve')}
        </Button>
      )}
      {canPublish && onPublish && (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<PublishIcon />}
          onClick={onPublish}
          disabled={isSaving}
        >
          {t('workflow.publish')}
        </Button>
      )}
    </>
  );
}
