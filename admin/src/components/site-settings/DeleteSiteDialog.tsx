import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteSite } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { DangerConfirmDialog } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';

interface DeleteSiteDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Delete-site flow for the Danger zone (#712). The delete is a soft-delete
 * (#711) — the backend stamps `deleted_at` and a purge worker reclaims the
 * record after a 30-day grace window — so the confirm copy and the success
 * toast tell the user the action is recoverable. On success we invalidate
 * the `['sites']` cache (which makes {@link SiteContext} drop the now-deleted
 * site from its selection) and redirect to the site list.
 */
export default function DeleteSiteDialog({
  open,
  onClose,
}: DeleteSiteDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId, selectedSite } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const siteName = selectedSite?.name ?? '';

  const mutation = useMutation({
    mutationFn: () => deleteSite(selectedSiteId),
    onSuccess: () => {
      showSuccess(t('siteSettings.danger.delete.gracePeriodNote'));
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
      navigate('/sites');
      onClose();
    },
    onError: (err: unknown) => showError(err),
  });

  if (!open) return null;

  return (
    <DangerConfirmDialog
      open
      title={t('siteSettings.danger.delete.confirm.title')}
      body={t('siteSettings.danger.delete.confirm.body', { site: siteName })}
      confirmPhrase={siteName}
      confirmLabel={t('siteSettings.danger.delete.confirm.label')}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
