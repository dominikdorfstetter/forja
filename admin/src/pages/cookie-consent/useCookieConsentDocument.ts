import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createLegalDocument, getLegalDocuments, updateLegalDocument } from '@/services/legal';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The site's (single) CookieConsent legal document plus its lifecycle
 * mutations: create it when missing, publish / unpublish it.
 */
export function useCookieConsentDocument(selectedSiteId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const invalidateDoc = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.legalCookieConsent(selectedSiteId) });

  const { data: cookieDoc, isLoading: docLoading, error: docError } = useQuery({
    queryKey: queryKeys.legalCookieConsent(selectedSiteId),
    queryFn: async () => {
      const result = await getLegalDocuments(selectedSiteId!, { page: 1, page_size: 100 });
      return result.data.find((d) => d.document_type === 'CookieConsent') ?? null;
    },
    enabled: !!selectedSiteId,
  });

  const createDocMutation = useMutation({
    mutationFn: () => createLegalDocument(selectedSiteId!, {
      cookie_name: 'cookie_consent',
      document_type: 'CookieConsent',
      status: 'Draft',
      site_ids: [selectedSiteId!],
    }),
    onSuccess: () => {
      invalidateDoc();
      showSuccess(t('cookieConsent.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const publishMutation = useMutation({
    mutationFn: () => updateLegalDocument(cookieDoc!.id, { status: 'Published' }),
    onSuccess: () => {
      invalidateDoc();
      showSuccess(t('legal.messages.published'));
    },
    onError: (error) => showError(error),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => updateLegalDocument(cookieDoc!.id, { status: 'Draft' }),
    onSuccess: () => {
      invalidateDoc();
      showSuccess(t('legal.messages.unpublished'));
    },
    onError: (error) => showError(error),
  });

  return { cookieDoc, docLoading, docError, createDocMutation, publishMutation, unpublishMutation };
}
