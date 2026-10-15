import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSiteSettings, updateSite, updateSiteSettings } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { UpdateSiteRequest } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { parseQuotaGb, quotaBytesToGbInput } from './siteDetailUtils';

/**
 * Write-side of the site detail page: inline field edits (admins) plus the
 * sysadmin-only enable toggle and storage quota (backed by site settings,
 * fetched only for masters).
 */
export function useSiteDetailActions(id: string, isMaster: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const { data: settings } = useQuery({
    queryKey: queryKeys.siteDetailSettings(id),
    queryFn: () => getSiteSettings(id),
    enabled: !!id && isMaster,
  });

  const [quotaInputGb, setQuotaInputGb] = useState<string>('');

  useEffect(() => {
    if (settings?.storage_quota_bytes) {
      setQuotaInputGb(quotaBytesToGbInput(settings.storage_quota_bytes));
    }
  }, [settings?.storage_quota_bytes]);

  const invalidateSite = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.site(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
  };

  const updateSiteMutation = useMutation({
    mutationFn: (data: { is_active?: boolean }) => updateSite(id, data),
    onSuccess: () => {
      invalidateSite();
      showSuccess(t('siteDetail.messages.updated'));
    },
    onError: showError,
  });

  const updateQuotaMutation = useMutation({
    mutationFn: (quotaBytes: number) =>
      updateSiteSettings(id, { storage_quota_bytes: quotaBytes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteDetailSettings(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteStorage(id) });
      showSuccess(t('siteDetail.messages.quotaUpdated'));
    },
    onError: showError,
  });

  /** Inline-edit save: persist one field, then refresh site + site list. */
  const saveField = async (patch: UpdateSiteRequest) => {
    await updateSite(id, patch);
    invalidateSite();
  };

  const saveQuota = () => {
    const quotaBytes = parseQuotaGb(quotaInputGb);
    if (quotaBytes === null) return;
    updateQuotaMutation.mutate(quotaBytes);
  };

  return {
    saveField,
    quotaInputGb,
    setQuotaInputGb,
    saveQuota,
    savingQuota: updateQuotaMutation.isPending,
    setActive: (isActive: boolean) => updateSiteMutation.mutate({ is_active: isActive }),
    savingActive: updateSiteMutation.isPending,
  };
}

export type SiteDetailActions = ReturnType<typeof useSiteDetailActions>;
