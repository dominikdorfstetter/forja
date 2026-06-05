import { Box, Button, Collapse, Typography } from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';

interface BulkActionToolbarProps {
  selectedCount: number;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  onClear: () => void;
  canWrite: boolean;
  isAdmin: boolean;
  loading?: boolean;
}

export default function BulkActionToolbar({
  selectedCount,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onDelete,
  onClear,
  canWrite,
  isAdmin,
  loading,
}: BulkActionToolbarProps) {
  const { t } = useTranslation();

  return (
    <Collapse in={selectedCount > 0}>
      <Box
        role="toolbar"
        aria-label={t('bulk.toolbar')}
        data-testid="bulk-toolbar"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          mb: 1,
          bgcolor: 'action.selected',
          borderRadius: 1,
        }}
      >
        <Typography variant="body2" sx={{ mr: 1 }} aria-live="polite" aria-atomic="true" data-testid="bulk-toolbar.count">
          {t('bulk.selectedCount', { count: selectedCount })}
        </Typography>
        {canWrite && onPublish && (
          <Button
            size="small"
            startIcon={<PublishIcon />}
            onClick={onPublish}
            disabled={loading}
            data-testid="bulk-toolbar.btn.publish"
          >
            {t('bulk.publish')}
          </Button>
        )}
        {canWrite && onUnpublish && (
          <Button
            size="small"
            startIcon={<UnpublishedIcon />}
            onClick={onUnpublish}
            disabled={loading}
            data-testid="bulk-toolbar.btn.unpublish"
          >
            {t('bulk.unpublish')}
          </Button>
        )}
        {canWrite && onArchive && (
          <Button
            size="small"
            color="warning"
            startIcon={<ArchiveIcon />}
            onClick={onArchive}
            disabled={loading}
            data-testid="bulk-toolbar.btn.archive"
          >
            {t('bulk.archive')}
          </Button>
        )}
        {canWrite && onRestore && (
          <Button
            size="small"
            startIcon={<UnarchiveIcon />}
            onClick={onRestore}
            disabled={loading}
            data-testid="bulk-toolbar.btn.restore"
          >
            {t('bulk.restore')}
          </Button>
        )}
        {isAdmin && onDelete && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={loading}
            data-testid="bulk-toolbar.btn.delete"
          >
            {t('bulk.delete')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<ClearIcon />} onClick={onClear} disabled={loading} data-testid="bulk-toolbar.btn.clear">
          {t('bulk.clearSelection')}
        </Button>
      </Box>
    </Collapse>
  );
}
