import { Box, Button, Collapse, Typography } from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';

interface BulkActionToolbarProps {
  selectedCount: number;
  onPublish?: () => void;
  onUnpublish?: () => void;
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
        <Typography variant="body2" sx={{ mr: 1 }}>
          {t('bulk.selectedCount', { count: selectedCount })}
        </Typography>
        {canWrite && onPublish && (
          <Button
            size="small"
            startIcon={<PublishIcon />}
            onClick={onPublish}
            disabled={loading}
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
          >
            {t('bulk.unpublish')}
          </Button>
        )}
        {isAdmin && onDelete && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={loading}
          >
            {t('bulk.delete')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<ClearIcon />} onClick={onClear} disabled={loading}>
          {t('bulk.clearSelection')}
        </Button>
      </Box>
    </Collapse>
  );
}
