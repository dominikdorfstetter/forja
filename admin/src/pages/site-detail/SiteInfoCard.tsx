import type { ComponentProps, ReactNode } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Site, UpdateSiteRequest } from '@/types/api';
import InlineEditField from '@/components/shared/InlineEditField';
import SiteDetailSection from './SiteDetailSection';

type GridItemSize = ComponentProps<typeof Grid>['size'];

const HALF: GridItemSize = { xs: 12, sm: 6 };

function InfoField({ label, size, children }: { label: string; size: GridItemSize; children: ReactNode }) {
  return (
    <Grid size={size}>
      <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
        {label}
      </Typography>
      {children}
    </Grid>
  );
}

function ActiveStatusPill({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.1,
        height: 22,
        mt: 0.25,
        borderRadius: '999px',
        bgcolor: active ? 'var(--tertiary-container)' : 'var(--surface-container-high)',
        color: active ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)',
        border: active ? 'none' : '1px solid var(--outline-variant)',
        fontSize: 11,
        fontWeight: 600,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        letterSpacing: 0.3,
      }}
    >
      {active ? t('common.status.active') : t('common.status.inactive')}
    </Box>
  );
}

interface SiteInfoCardProps {
  site: Site;
  canEdit: boolean;
  onSaveField: (patch: UpdateSiteRequest) => Promise<void>;
}

/** Core site fields; name + description are inline-editable by admins. */
export default function SiteInfoCard({ site, canEdit, onSaveField }: SiteInfoCardProps) {
  const { t } = useTranslation();

  return (
    <SiteDetailSection title={t('siteDetail.siteInfo')} mb={3}>
      <Grid container spacing={2}>
        <InfoField label={t('siteDetail.fields.name')} size={HALF}>
          <InlineEditField
            value={site.name}
            variant="body1"
            disabled={!canEdit}
            onSave={(name) => onSaveField({ name })}
          />
        </InfoField>
        <InfoField label={t('siteDetail.fields.slug')} size={HALF}>
          <Typography variant="body1" sx={{ fontFamily: 'var(--font-mono)' }}>
            {site.slug}
          </Typography>
        </InfoField>
        <InfoField label={t('siteDetail.fields.description')} size={12}>
          <InlineEditField
            value={site.description || ''}
            variant="body1"
            disabled={!canEdit}
            onSave={(description) => onSaveField({ description })}
          />
        </InfoField>
        <InfoField label={t('siteDetail.fields.timezone')} size={HALF}>
          <Typography variant="body1">{site.timezone}</Typography>
        </InfoField>
        <InfoField label={t('siteDetail.fields.status')} size={HALF}>
          <ActiveStatusPill active={site.is_active} />
        </InfoField>
      </Grid>
    </SiteDetailSection>
  );
}
