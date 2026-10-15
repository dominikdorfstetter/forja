/**
 * Header status chip + publish toggle for an existing collection entry (#798).
 * Both render nothing on create flows (no entry yet).
 */
import { useTranslation } from 'react-i18next';
import { Chip } from '@mui/material';

import { M3Button } from '@/components/design-system';
import type { CustomEntryResponse } from '@/types/customTypes';

export function EntryStatusChip({ entry }: { entry: CustomEntryResponse | undefined }) {
  const { t } = useTranslation();
  if (!entry) return null;
  const isPublished = entry.status === 'published';
  return (
    <Chip
      size="small"
      label={isPublished ? t('collections.statusPublished') : t('collections.statusDraft')}
      color={isPublished ? 'success' : 'default'}
    />
  );
}

interface EntryPublishToggleProps {
  entry: CustomEntryResponse | undefined;
  loading: boolean;
  onToggle: () => void;
}

export function EntryPublishToggle({ entry, loading, onToggle }: EntryPublishToggleProps) {
  const { t } = useTranslation();
  if (!entry) return null;
  const isPublished = entry.status === 'published';
  return (
    <M3Button
      variant="outlined"
      size="md"
      icon={isPublished ? 'unpublished' : 'publish'}
      onClick={onToggle}
      loading={loading}
      data-testid="toggle-publish"
    >
      {isPublished ? t('collections.unpublish') : t('collections.publish')}
    </M3Button>
  );
}
