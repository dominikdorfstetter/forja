import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Controller, type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { AutosaveStatus } from '@/hooks/useAutosave';
import type { ContentStatus, PreviewTemplate } from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';

const ALL_STATUS_OPTIONS: ContentStatus[] = ['Draft', 'InReview', 'Scheduled', 'Published', 'Archived'];

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
  // Workflow props
  allowedStatuses?: ContentStatus[];
  canSubmitForReview?: boolean;
  canApprove?: boolean;
  canRequestChanges?: boolean;
  onSubmitForReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  previewTemplates?: PreviewTemplate[];
  onPreview?: (templateUrl: string) => void;
}

export default function PageEditorToolbar({
  control,
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
  allowedStatuses,
  canSubmitForReview,
  canApprove,
  canRequestChanges,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  previewTemplates,
  onPreview,
}: PageEditorToolbarProps) {
  const { t } = useTranslation();
  const [scheduleAnchor, setScheduleAnchor] = useState<HTMLElement | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);

  const publishStart = watch('publish_start');
  const publishEnd = watch('publish_end');
  const currentStatus = watch('status');

  const statusOptions = allowedStatuses ?? ALL_STATUS_OPTIONS;

  const handleClearSchedule = () => {
    setValue('publish_start', null, { shouldDirty: true });
    setValue('publish_end', null, { shouldDirty: true });
    if (currentStatus === 'Scheduled') {
      setValue('status', 'Draft', { shouldDirty: true });
    }
    setScheduleAnchor(null);
  };

  const statusChip = () => {
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
      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              {...field}
              size="small"
              disabled={!canWrite}
              onChange={(e) => {
                const newStatus = e.target.value;
                field.onChange(newStatus);
                if (newStatus !== 'Scheduled' && publishStart) {
                  setValue('publish_start', null, { shouldDirty: true });
                  setValue('publish_end', null, { shouldDirty: true });
                }
              }}
            >
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      {/* Workflow action buttons */}
      {canSubmitForReview && currentStatus === 'Draft' && onSubmitForReview && (
        <Button
          size="small"
          variant="outlined"
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
          variant="outlined"
          color="success"
          startIcon={<CheckCircleIcon />}
          onClick={onApprove}
          disabled={isSaving}
        >
          {t('workflow.approve')}
        </Button>
      )}
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

      <Chip label={pageType} size="small" variant="outlined" />

      <Box sx={{ borderLeft: 1, borderColor: 'divider', height: 24, mx: 0.5 }} />

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

      <Box sx={{ mx: 1 }}>{statusChip()}</Box>

      <Box sx={{ flex: 1 }} />

      {previewTemplates && previewTemplates.length > 0 && onPreview && (
        <>
          {previewTemplates.length === 1 ? (
            <Tooltip title={t('common.actions.preview')}>
              <IconButton size="small" onClick={() => onPreview(previewTemplates[0].url)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={t('common.actions.preview')}>
                <IconButton size="small" onClick={(e) => setPreviewAnchor(e.currentTarget)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={previewAnchor}
                open={Boolean(previewAnchor)}
                onClose={() => setPreviewAnchor(null)}
              >
                {previewTemplates.map((pt) => (
                  <MenuItem
                    key={pt.url}
                    onClick={() => {
                      onPreview(pt.url);
                      setPreviewAnchor(null);
                    }}
                  >
                    {pt.name}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </>
      )}

      <Tooltip title={t('entityHistory.title')}>
        <IconButton size="small" onClick={onToggleHistory}>
          <HistoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Button
        variant="contained"
        size="small"
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={isSaving || !canWrite}
      >
        {isSaving ? t('common.actions.saving') : t('common.actions.save')}
      </Button>
    </Box>
  );
}
