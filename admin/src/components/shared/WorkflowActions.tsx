import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';

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

/**
 * Workflow action cluster rendered alongside every content editor
 * (Blogs / Pages / Legal). Each action maps to an M3Button — outlined
 * for reversible / de-escalating operations (request changes,
 * unpublish, archive, restore), filled for progressive workflow
 * transitions (submit, approve, publish). Archive uses the danger
 * palette so it reads as a warning action.
 */
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
        <M3Button size="sm" variant="outlined" icon="undo" onClick={onRequestChanges} disabled={isSaving}>
          {t('workflow.requestChanges')}
        </M3Button>
      )}
      {canUnpublish && onUnpublish && (
        <M3Button size="sm" variant="outlined" icon="unpublished" onClick={onUnpublish} disabled={isSaving}>
          {t('workflow.unpublish')}
        </M3Button>
      )}
      {canArchive && onArchive && (
        <M3Button size="sm" variant="outlined" icon="archive" danger onClick={onArchive} disabled={isSaving}>
          {t('workflow.archive')}
        </M3Button>
      )}
      {canRestore && onRestore && (
        <M3Button size="sm" variant="outlined" icon="unarchive" onClick={onRestore} disabled={isSaving}>
          {t('workflow.restore')}
        </M3Button>
      )}
      {canSubmitForReview && currentStatus === 'Draft' && onSubmitForReview && (
        <M3Button size="sm" variant="filled" icon="send" onClick={onSubmitForReview} disabled={isSaving}>
          {t('workflow.submitForReview')}
        </M3Button>
      )}
      {canApprove && currentStatus === 'InReview' && onApprove && (
        <M3Button size="sm" variant="filled" icon="check_circle" onClick={onApprove} disabled={isSaving}>
          {t('workflow.approve')}
        </M3Button>
      )}
      {canPublish && onPublish && (
        <M3Button
          size="sm"
          variant="filled"
          icon="publish"
          onClick={onPublish}
          disabled={isSaving}
          data-testid="publish-post"
        >
          {t('workflow.publish')}
        </M3Button>
      )}
    </>
  );
}
