import type { ReactNode } from 'react';
import { Alert } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';

interface MediaLibraryStatusProps {
  hasSite: boolean;
  isLoading: boolean;
  hasError: boolean;
  /** The library itself, rendered once a site is selected and media loaded. */
  children: ReactNode;
}

/** No-site / loading / error gate in front of the media library. */
export default function MediaLibraryStatus({ hasSite, isLoading, hasError, children }: MediaLibraryStatusProps) {
  const { t } = useTranslation();

  if (!hasSite) {
    return <EmptyState icon={<ImageIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('media.empty.noSite')} />;
  }
  if (isLoading) return <LoadingState label={t('media.loading')} />;
  if (hasError) return <Alert severity="error">{t('media.loadError')}</Alert>;
  return children;
}
