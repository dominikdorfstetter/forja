import type { ReactNode } from 'react';
import { Box, Alert } from '@mui/material';
import CookieIcon from '@mui/icons-material/Cookie';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import CookieConsentEditor from './cookie-consent/CookieConsentEditor';
import { useCookieConsentDocument } from './cookie-consent/useCookieConsentDocument';

/** Page frame for the pre-document states (no site / loading / error / missing). */
function CookieConsentShell({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Box data-testid="cookie-consent.page">
      {!embedded && <PageHeader icon="cookie" title={t('cookieConsent.title')} subtitle={t('cookieConsent.subtitle')} />}
      {children}
    </Box>
  );
}

interface CookieConsentPageProps {
  embedded?: boolean;
}

export default function CookieConsentPage({ embedded = false }: CookieConsentPageProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite } = useAuth();
  const { cookieDoc, docLoading, docError, createDocMutation, publishMutation, unpublishMutation } =
    useCookieConsentDocument(selectedSiteId);

  // No site selected
  if (!selectedSiteId) {
    return (
      <CookieConsentShell embedded={embedded}>
        <EmptyState
          icon={<CookieIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('cookieConsent.empty.noSite')}
        />
      </CookieConsentShell>
    );
  }

  // Loading the document
  if (docLoading) {
    return (
      <CookieConsentShell embedded={embedded}>
        <LoadingState label={t('cookieConsent.loading')} />
      </CookieConsentShell>
    );
  }

  // Error loading document
  if (docError) {
    return (
      <CookieConsentShell embedded={embedded}>
        <Alert severity="error">{t('common.errors.loadFailed')}</Alert>
      </CookieConsentShell>
    );
  }

  // No cookie consent document yet
  if (!cookieDoc) {
    return (
      <CookieConsentShell embedded={embedded}>
        <EmptyState
          icon={<CookieIcon sx={{ fontSize: 64 }} />}
          title={t('cookieConsent.empty.title')}
          description={t('cookieConsent.empty.description')}
          action={canWrite ? {
            label: t('cookieConsent.createDocument'),
            onClick: () => createDocMutation.mutate(),
          } : undefined}
        />
      </CookieConsentShell>
    );
  }

  return (
    <CookieConsentEditor
      cookieDoc={cookieDoc}
      embedded={embedded}
      publish={{ run: () => publishMutation.mutate(), pending: publishMutation.isPending }}
      unpublish={{ run: () => unpublishMutation.mutate(), pending: unpublishMutation.isPending }}
    />
  );
}
