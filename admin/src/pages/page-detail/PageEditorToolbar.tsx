import { useState } from 'react';
import { Box, Menu, MenuItem } from '@mui/material';
import { type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { PreviewTemplate } from '@/types/api';
import StatusChip from '@/components/shared/StatusChip';
import PageTypeChip from '@/components/shared/PageTypeChip';
import SchedulePopover from '@/components/shared/SchedulePopover';
import WorkflowActions from '@/components/shared/WorkflowActions';
import { M3Button, M3IconButton } from '@/components/design-system';
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
  const fmt = useLocalizedFormat();
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

  const schedulePill = (label: string, tone: 'info' | 'warn', onClear?: () => void) => {
    const paint =
      tone === 'info'
        ? { bg: 'color-mix(in srgb, var(--info) 18%, transparent)', fg: 'var(--info)' }
        : { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' };
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 1.25,
          pr: onClear ? 0.5 : 1.25,
          height: 24,
          borderRadius: '999px',
          bgcolor: paint.bg,
          color: paint.fg,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
          fontVariationSettings: '"wght" 600, "opsz" 11',
        }}
      >
        {label}
        {onClear && (
          <M3IconButton name="close" size={18} tooltip={t('common.actions.clear', 'Clear')} onClick={onClear} />
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 64,
        zIndex: 10,
        bgcolor: 'var(--surface-container-low)',
        borderBottom: '1px solid var(--outline-variant)',
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
      {publishStart &&
        schedulePill(
          t('scheduling.scheduledFor', { date: fmt(publishStart, 'PPp') }),
          'info',
          canWrite ? handleClearSchedule : undefined,
        )}
      {publishEnd &&
        schedulePill(t('scheduling.expiresAt', { date: fmt(publishEnd, 'PPp') }), 'warn')}

      <Box sx={{ borderLeft: '1px solid var(--outline-variant)', height: 24, mx: 0.5 }} />

      {/* Group 2: Edit Tools */}
      <M3IconButton
        name="undo"
        size={32}
        tooltip={`${t('forms.undo')} (Ctrl+Z)`}
        disabled={!canUndo}
        onClick={onUndo}
      />
      <M3IconButton
        name="redo"
        size={32}
        tooltip={`${t('forms.redo')} (Ctrl+Shift+Z)`}
        disabled={!canRedo}
        onClick={onRedo}
      />

      <Box sx={{ flex: 1 }} />

      {/* Group 3: Utility Icons */}
      {canSchedule && (
        <M3IconButton
          name="calendar_month"
          size={32}
          tooltip={t('scheduling.publishAt')}
          disabled={!canWrite}
          active={!!publishStart}
          onClick={(e) => setScheduleAnchor(e.currentTarget)}
        />
      )}

      {previewTemplates && previewTemplates.length > 0 && onPreview && (
        <M3IconButton
          name="visibility"
          size={32}
          tooltip={t('common.actions.preview')}
          onClick={(e) =>
            previewTemplates.length === 1
              ? onPreview(previewTemplates[0].url)
              : setPreviewAnchor(e.currentTarget)
          }
        />
      )}

      <M3IconButton
        name="history"
        size={32}
        tooltip={t('entityHistory.title')}
        onClick={onToggleHistory}
      />

      <Box sx={{ borderLeft: '1px solid var(--outline-variant)', height: 24, mx: 0.5 }} />

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

      <M3Button
        size="sm"
        variant="filled"
        icon="save"
        onClick={onSave}
        disabled={isSaving || !canWrite}
      >
        {isSaving ? t('common.actions.saving') : t('common.actions.save')}
      </M3Button>

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
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '14px',
              mt: 0.5,
            },
          },
        }}
      >
        {previewTemplates?.map((pt) => (
          <MenuItem
            key={pt.url}
            onClick={() => {
              onPreview?.(pt.url);
              setPreviewAnchor(null);
            }}
            sx={{
              fontSize: 14,
              borderRadius: '10px',
              mx: 0.5,
              my: 0.25,
              '&:hover': { bgcolor: 'var(--surface-container-highest)' },
            }}
          >
            {pt.name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
