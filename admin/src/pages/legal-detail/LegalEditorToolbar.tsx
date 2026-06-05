import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/CalendarMonth';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import StatusChip from '@/components/shared/StatusChip';
import SchedulePopover from '@/components/shared/SchedulePopover';
import WorkflowActions from '@/components/shared/WorkflowActions';
import type { LegalContentFormData } from './legalDetailSchema';

interface LegalEditorToolbarProps {
  watch: UseFormWatch<LegalContentFormData>;
  setValue: UseFormSetValue<LegalContentFormData>;
  version: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onToggleHistory: () => void;
  isSaving: boolean;
  canWrite: boolean;
  canSubmitForReview?: boolean;
  canApprove?: boolean;
  canRequestChanges?: boolean;
  canPublish?: boolean;
  canUnpublish?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  canSchedule?: boolean;
  onSubmitForReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  canCreateVersion?: boolean;
  onCreateVersion?: () => void;
}

export default function LegalEditorToolbar({
  watch,
  setValue,
  version,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onToggleHistory,
  isSaving,
  canWrite,
  canSubmitForReview,
  canApprove,
  canRequestChanges,
  canPublish,
  canUnpublish,
  canArchive,
  canRestore,
  canSchedule,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  canCreateVersion,
  onCreateVersion,
}: LegalEditorToolbarProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const [scheduleAnchor, setScheduleAnchor] = useState<HTMLElement | null>(null);

  const publishStart = watch('publish_start');
  const publishEnd = watch('publish_end');
  const currentStatus = watch('status');

  const handleClearSchedule = () => {
    setValue('publish_start', null, { shouldDirty: true });
    setValue('publish_end', null, { shouldDirty: true });
    if (currentStatus === 'Scheduled') {
      setValue('status', 'Draft', { shouldDirty: true });
    }
    setScheduleAnchor(null);
  };

  return (
    <Box
      data-testid="legal-detail.toolbar"
      sx={{
        position: 'sticky',
        top: 64,
        zIndex: 10,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
      }}
    >
      {/* Group 1: Identity & Status */}
      <StatusChip value={currentStatus} testId="legal-status" />
      <Chip label={`v${version}`} size="small" variant="outlined" />
      {publishStart && (
        <Chip
          label={t('scheduling.scheduledFor', { date: fmt(publishStart, 'PPp') })}
          size="small"
          color="info"
          variant="outlined"
          onDelete={canWrite ? handleClearSchedule : undefined}
        />
      )}
      {publishEnd && (
        <Chip
          label={t('scheduling.expiresAt', { date: fmt(publishEnd, 'PPp') })}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 24, mx: 0.5 }} />

      {/* Group 2: Edit Tools */}
      <Tooltip title={`${t('forms.undo')} (Ctrl+Z)`}>
        <span>
          <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={`${t('forms.redo')} (Ctrl+Shift+Z)`}>
        <span>
          <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {/* Group 3: Utility Icons */}
      {canSchedule && (
        <Tooltip title={t('scheduling.publishAt')}>
          <IconButton
            size="small"
            onClick={(e) => setScheduleAnchor(e.currentTarget)}
            disabled={!canWrite}
            color={publishStart ? 'primary' : 'default'}
          >
            <ScheduleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {canCreateVersion && (
        <Tooltip title={t('legalDetail.versions.createNew')}>
          <IconButton size="small" onClick={onCreateVersion}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title={t('entityHistory.title')}>
        <IconButton size="small" onClick={onToggleHistory}>
          <HistoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 24, mx: 0.5 }} />

      {/* Group 4: Workflow Actions */}
      <WorkflowActions
        currentStatus={currentStatus}
        isSaving={isSaving}
        canSubmitForReview={canSubmitForReview}
        canApprove={canApprove}
        canRequestChanges={canRequestChanges}
        canPublish={canPublish}
        canUnpublish={canUnpublish}
        canArchive={canArchive}
        canRestore={canRestore}
        onSubmitForReview={onSubmitForReview}
        onApprove={onApprove}
        onRequestChanges={onRequestChanges}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onArchive={onArchive}
        onRestore={onRestore}
      />

      <Button
        variant="contained"
        size="small"
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={isSaving || !canWrite}
        data-testid="legal-detail.save"
      >
        {isSaving ? t('common.actions.saving') : t('common.actions.save')}
      </Button>

      {/* Schedule Popover */}
      <SchedulePopover
        anchorEl={scheduleAnchor}
        onClose={() => setScheduleAnchor(null)}
        publishStart={publishStart}
        publishEnd={publishEnd}
        onPublishStartChange={(iso) => {
          setValue('publish_start', iso, { shouldDirty: true });
          if (iso) {
            const date = new Date(iso);
            if (date > new Date()) {
              setValue('status', 'Scheduled', { shouldDirty: true });
            }
          }
        }}
        onPublishEndChange={(iso) => {
          setValue('publish_end', iso, { shouldDirty: true });
        }}
        onClear={handleClearSchedule}
      />
    </Box>
  );
}
