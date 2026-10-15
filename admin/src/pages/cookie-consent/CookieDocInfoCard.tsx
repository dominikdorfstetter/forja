import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { LegalDocumentResponse } from '@/types/api';
import StatusChip from '@/components/shared/StatusChip';
import { Icon, M3Button } from '@/components/design-system';

export interface PendingAction {
  run: () => void;
  pending: boolean;
}

interface CookieDocInfoCardProps {
  cookieDoc: LegalDocumentResponse;
  canWrite: boolean;
  publish: PendingAction;
  unpublish: PendingAction;
  onEditContent: () => void;
}

/** Publish/unpublish toggle for the document's current status (writers only). */
function StatusAction({ status, publish, unpublish }: { status: string; publish: PendingAction; unpublish: PendingAction }) {
  const { t } = useTranslation();
  if (status === 'Draft') {
    return (
      <M3Button
        size="sm"
        variant="filled"
        icon="publish"
        onClick={publish.run}
        disabled={publish.pending}
        data-testid="cookie-consent.publish-btn"
      >
        {t('workflow.publish')}
      </M3Button>
    );
  }
  if (status === 'Published') {
    return (
      <M3Button
        size="sm"
        variant="outlined"
        icon="unpublished"
        onClick={unpublish.run}
        disabled={unpublish.pending}
        data-testid="cookie-consent.unpublish-btn"
      >
        {t('workflow.unpublish')}
      </M3Button>
    );
  }
  return null;
}

/** Document info — tokenised card with tonal icon tile. */
export default function CookieDocInfoCard({ cookieDoc, canWrite, publish, unpublish, onEditContent }: CookieDocInfoCardProps) {
  const { t } = useTranslation();

  return (
    <Box
      data-testid="cookie-consent.doc-info"
      sx={{
        mb: 3,
        p: 2.5,
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 44,
          height: 44,
          borderRadius: '14px',
          bgcolor: 'var(--primary-container)',
          color: 'var(--on-primary-container)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="cookie" size={24} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          component="div"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 600, "opsz" 11',
          }}
        >
          {t('legalDetail.cookieName')}
        </Box>
        <Box
          component="div"
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--on-surface)',
            wordBreak: 'break-all',
          }}
        >
          {cookieDoc.cookie_name}
        </Box>
      </Box>
      <StatusChip value={cookieDoc.status} size="medium" />
      <Box sx={{ flex: 1 }} />
      {canWrite && <StatusAction status={cookieDoc.status} publish={publish} unpublish={unpublish} />}
      <M3Button
        size="sm"
        variant="outlined"
        icon="open_in_new"
        onClick={onEditContent}
        data-testid="cookie-consent.edit-content-btn"
      >
        {t('cookieConsent.editContent')}
      </M3Button>
    </Box>
  );
}
