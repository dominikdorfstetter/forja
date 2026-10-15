import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';

interface TrashBatchBarProps {
  selectedCount: number;
  canWrite: boolean;
  isAdmin: boolean;
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}

/** Bulk actions for the current selection — restore needs write access, permanent delete is admin-only. */
export default function TrashBatchBar({
  selectedCount,
  canWrite,
  isAdmin,
  busy,
  onRestore,
  onDelete,
}: TrashBatchBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0 || !canWrite) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      <M3Button
        variant="outlined"
        size="sm"
        icon="restore"
        onClick={onRestore}
        disabled={busy}
        data-testid="trash.batch-restore"
      >
        {t('trash.restore')} ({selectedCount})
      </M3Button>
      {isAdmin && (
        <M3Button
          variant="outlined"
          size="sm"
          icon="delete_forever"
          danger
          onClick={onDelete}
          disabled={busy}
          data-testid="trash.batch-delete"
        >
          {t('trash.permanentDelete')} ({selectedCount})
        </M3Button>
      )}
    </Stack>
  );
}
