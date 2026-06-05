import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';
import { useSiteExport } from '@/hooks/useSiteExport';
import { downloadSiteExport } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { triggerBlobDownload } from '@/utils/downloadBlob';

interface ExportSiteActionProps {
  siteId: string;
  /** Mirrors the backend export gate (owner / site-admin / system-admin). */
  disabled: boolean;
}

/**
 * Export action for the Danger zone (#718). Non-destructive, so unlike
 * its siblings there is no type-to-confirm dialog: the button itself
 * drives the async flow — enqueue, poll (via {@link useSiteExport}), then
 * an authenticated blob download once `ready`. Status transitions are
 * mirrored into an `aria-live` region so they are announced.
 */
export default function ExportSiteAction({
  siteId,
  disabled,
}: ExportSiteActionProps) {
  const { t } = useTranslation();
  const { showError } = useErrorSnackbar();
  const { status, start, isStarting, startError, downloadUrl } =
    useSiteExport(siteId);
  const [downloading, setDownloading] = useState(false);

  // A 403/409 from the enqueue surfaces as a toast — consistent with the
  // sibling Danger-zone actions; the hook leaves presentation to us.
  useEffect(() => {
    if (startError) showError(startError);
  }, [startError, showError]);

  const inProgress = isStarting || status === 'queued' || status === 'running';

  const handleDownload = async () => {
    if (!downloadUrl) return;
    setDownloading(true);
    try {
      const blob = await downloadSiteExport(downloadUrl);
      triggerBlobDownload(blob, `site-export-${siteId}.zip`);
    } catch (err) {
      showError(err);
    } finally {
      setDownloading(false);
    }
  };

  const announcement =
    status === 'ready'
      ? t('siteSettings.danger.export.ready', 'Your export is ready to download.')
      : status === 'failed'
        ? t('siteSettings.danger.export.failed', 'Export failed. Please try again.')
        : inProgress
          ? t('siteSettings.danger.export.inProgress', 'Exporting…')
          : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      {status === 'ready' ? (
        <M3Button
          variant="ghost"
          size="sm"
          icon="download"
          loading={downloading}
          onClick={handleDownload}
          ariaLabel={t('siteSettings.danger.export.download', 'Download archive')}
          data-testid="site-settings.danger.export.download"
        >
          {t('siteSettings.danger.export.download', 'Download archive')}
        </M3Button>
      ) : (
        <M3Button
          variant="ghost"
          size="sm"
          icon="download"
          loading={inProgress}
          disabled={disabled || inProgress}
          onClick={start}
          ariaLabel={
            inProgress
              ? t('siteSettings.danger.export.inProgress', 'Exporting…')
              : t('siteSettings.danger.export.action', 'Export')
          }
          data-testid="site-settings.danger.export.start"
        >
          {inProgress
            ? t('siteSettings.danger.export.inProgress', 'Exporting…')
            : t('siteSettings.danger.export.action', 'Export')}
        </M3Button>
      )}

      <span
        role="status"
        aria-live="polite"
        data-testid="site-settings.danger.export.status"
        style={{
          fontSize: 12,
          color:
            status === 'failed' ? 'var(--err)' : 'var(--on-surface-variant)',
          minHeight: 16,
          textAlign: 'right',
          maxWidth: 220,
        }}
      >
        {announcement}
      </span>
    </div>
  );
}
