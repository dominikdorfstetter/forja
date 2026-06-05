import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resetContent } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { DangerConfirmDialog } from '@/components/design-system';

interface ResetContentDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Reset-content flow for the Danger zone (#715). The backend (#714)
 * bulk soft-deletes every site-scoped content item and site-owned media
 * file into the **existing** 30-day trash — settings and members are
 * kept and the site itself stays — so the confirm copy and the success
 * toast tell the user the content is recoverable. Unlike DeleteSite we
 * do not navigate away; instead we invalidate every content cache (the
 * same key set TrashPage uses) so the now-emptied lists refetch.
 */
export default function ResetContentDialog({
  open,
  onClose,
}: ResetContentDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId, selectedSite } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();
  const queryClient = useQueryClient();

  const siteName = selectedSite?.name ?? '';

  const mutation = useMutation({
    mutationFn: () => resetContent(selectedSiteId),
    onSuccess: () => {
      showSuccess(t('siteSettings.danger.reset.success'));
      // Reset moves content/media into the trash — invalidate the same
      // caches a trash mutation does so the emptied lists refetch and
      // the trash view reflects the new items.
      for (const key of [
        ['trash', selectedSiteId],
        ['trash-count', selectedSiteId],
        ['blogs'],
        ['pages'],
        ['media'],
        ['documents'],
        ['legal'],
        ['social-links'],
        ['navigation-menus'],
        ['navigation-items'],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
    },
    onError: (err: unknown) => showError(err),
  });

  if (!open) return null;

  return (
    <DangerConfirmDialog
      open
      title={t('siteSettings.danger.reset.confirm.title')}
      body={t('siteSettings.danger.reset.confirm.body', { site: siteName })}
      confirmPhrase={siteName}
      confirmLabel={t('siteSettings.danger.reset.confirm.label')}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
