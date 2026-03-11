import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/CalendarMonth';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { AutosaveStatus } from '@/hooks/useAutosave';
import type { PreviewTemplate } from '@/types/api';
import StatusChip from '@/components/shared/StatusChip';
import PageTypeChip from '@/components/shared/PageTypeChip';
import SchedulePopover from '@/components/shared/SchedulePopover';
import WorkflowActions from '@/components/shared/WorkflowActions';
import type { PageDetailFormData } from './pageDetailSchema';

interface PageEditorToolbarProps {
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  setValue: UseFormSetValue<PageDetailFormData>;
  pageType: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  autosaveStatus: AutosaveStatus;
  onSave: () => void;
  onToggleHistory: () => void;
  isSaving: boolean;
  canWrite: boolean;
  // Workflow action props
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
  previewTemplates?: PreviewTemplate[];
  onPreview?: (templateUrl: string) => void;
}

export default function PageEditorToolbar({
  watch,
  setValue,
  pageType,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  autosaveStatus,
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
  previewTemplates,
  onPreview,
}: PageEditorToolbarProps) {
  const { t } = useTranslation();
  const [scheduleAnchor, setScheduleAnchor] = useState<HTMLElement | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);

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

  const autosaveChip = () => {
    switch (autosaveStatus) {
      case 'saving':
        return <Chip label={t('pageDetail.toolbar.saving')} size="small" color="info" variant="outlined" />;
      case 'saved':
        return <Chip label={t('pageDetail.toolbar.saved')} size="small" color="success" variant="outlined" />;
      case 'error':
        return <Chip label={t('pageDetail.toolbar.saveFailed')} size="small" color="error" variant="outlined" />;
      default:
        return null;
    }
  };

  return (
    <Box
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
      <StatusChip value={currentStatus} />
      <PageTypeChip value={pageType} />
      {publishStart && (
        <Chip
          label={t('scheduling.scheduledFor', { date: format(new Date(publishStart), 'PPp') })}
          size="small"
          color="info"
          variant="outlined"
          onDelete={canWrite ? handleClearSchedule : undefined}
        />
      )}
      {publishEnd && (
        <Chip
          label={t('scheduling.expiresAt', { date: format(new Date(publishEnd), 'PPp') })}
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
      <Box sx={{ mx: 0.5 }}>{autosaveChip()}</Box>

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

      {previewTemplates && previewTemplates.length > 0 && onPreview && (
        <Tooltip title={t('common.actions.preview')}>
          <IconButton
            size="small"
            onClick={(e) =>
              previewTemplates.length === 1
                ? onPreview(previewTemplates[0].url)
                : setPreviewAnchor(e.currentTarget)
            }
          >
            <VisibilityIcon fontSize="small" />
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

      {/* Preview Menu */}
      <Menu
        anchorEl={previewAnchor}
        open={Boolean(previewAnchor)}
        onClose={() => setPreviewAnchor(null)}
      >
        {previewTemplates?.map((pt) => (
          <MenuItem
            key={pt.url}
            onClick={() => {
              onPreview?.(pt.url);
              setPreviewAnchor(null);
            }}
          >
            {pt.name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
