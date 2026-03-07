import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { AutosaveStatus } from '@/hooks/useAutosave';
import type { PreviewTemplate } from '@/types/api';
import StatusChip from '@/components/shared/StatusChip';
import type { BlogContentFormData } from './blogDetailSchema';

interface BlogEditorToolbarProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
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
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  showAiTranslate?: boolean;
  onAiTranslate?: () => void;
}

export default function BlogEditorToolbar({
  watch,
  setValue,
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
  sidebarOpen,
  onToggleSidebar,
  showAiTranslate,
  onAiTranslate,
}: BlogEditorToolbarProps) {
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
        return <Chip label={t('blogDetail.toolbar.saving')} size="small" color="info" variant="outlined" />;
      case 'saved':
        return <Chip label={t('blogDetail.toolbar.saved')} size="small" color="success" variant="outlined" />;
      case 'error':
        return <Chip label={t('blogDetail.toolbar.saveFailed')} size="small" color="error" variant="outlined" />;
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

      {showAiTranslate && onAiTranslate && (
        <Tooltip title={t('blogDetail.ai.translate')}>
          <IconButton size="small" onClick={onAiTranslate}>
            <AutoAwesomeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {onToggleSidebar && (
        <Tooltip title={t('blogDetail.sidebar.toggle')}>
          <IconButton
            size="small"
            onClick={onToggleSidebar}
            color={sidebarOpen ? 'primary' : 'default'}
          >
            <ViewSidebarIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title={t('entityHistory.title')}>
        <IconButton size="small" onClick={onToggleHistory}>
          <HistoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 24, mx: 0.5 }} />

      {/* Group 4: Workflow Actions (secondary → primary → save) */}
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
      <Popover
        open={Boolean(scheduleAnchor)}
        anchorEl={scheduleAnchor}
        onClose={() => setScheduleAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={2} sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2">{t('scheduling.publishAt')}</Typography>
          <DateTimePicker
            label={t('scheduling.publishAt')}
            value={publishStart ? new Date(publishStart) : null}
            onChange={(date) => {
              const iso = date ? date.toISOString() : null;
              setValue('publish_start', iso, { shouldDirty: true });
              if (date && date > new Date()) {
                setValue('status', 'Scheduled', { shouldDirty: true });
              }
            }}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
          <DateTimePicker
            label={t('scheduling.unpublishAt')}
            value={publishEnd ? new Date(publishEnd) : null}
            onChange={(date) => {
              const iso = date ? date.toISOString() : null;
              setValue('publish_end', iso, { shouldDirty: true });
            }}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearSchedule}
            disabled={!publishStart && !publishEnd}
          >
            {t('scheduling.clearSchedule')}
          </Button>
        </Stack>
      </Popover>

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
