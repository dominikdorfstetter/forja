import { Box, Divider, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button, Icon } from '@/components/design-system';
import type { SiteDetailActions } from './useSiteDetailActions';

interface SiteSysadminPanelProps {
  isActive: boolean;
  actions: SiteDetailActions;
}

/** Master-only controls: enable/disable the site and set its storage quota. */
export default function SiteSysadminPanel({ isActive, actions }: SiteSysadminPanelProps) {
  const { t } = useTranslation();
  const { quotaInputGb, setQuotaInputGb, saveQuota, savingQuota, setActive, savingActive } = actions;

  return (
    <Box
      data-testid="site-detail.sysadmin"
      sx={{
        mt: 3,
        p: 3,
        borderRadius: '16px',
        bgcolor: 'color-mix(in srgb, var(--primary) 8%, var(--surface-container-low))',
        border: '1px solid color-mix(in srgb, var(--primary) 35%, var(--outline-variant))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Icon name="admin_panel_settings" size={18} color="var(--primary)" />
        <Typography
          component="h2"
          sx={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--primary)',
            fontVariationSettings: '"wght" 700, "opsz" 16',
          }}
        >
          {t('siteDetail.sysadmin.title')}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: 12,
          color: 'var(--on-surface-variant)',
          mb: 2.5,
        }}
      >
        {t('siteDetail.sysadmin.subtitle')}
      </Typography>

      <Box sx={{ mb: 2.5 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={() => setActive(!isActive)}
              disabled={savingActive}
            />
          }
          label={
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {t('siteDetail.sysadmin.enabledLabel')}
            </Typography>
          }
        />
        <Typography sx={{ fontSize: 12, color: 'var(--on-surface-variant)', ml: 5 }}>
          {t('siteDetail.sysadmin.enabledHelp')}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'var(--outline-variant)', my: 2 }} />

      <Typography
        component="div"
        sx={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--on-surface)',
          mb: 0.5,
        }}
      >
        {t('siteDetail.sysadmin.quotaLabel')}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--on-surface-variant)', mb: 1.5 }}>
        {t('siteDetail.sysadmin.quotaHelp')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          type="number"
          size="small"
          value={quotaInputGb}
          onChange={(e) => setQuotaInputGb(e.target.value)}
          slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
          sx={{ width: 160 }}
          data-testid="site-detail.input.quota"
        />
        <M3Button
          variant="filled"
          size="sm"
          icon="save"
          onClick={saveQuota}
          disabled={savingQuota || quotaInputGb === ''}
          data-testid="site-detail.btn.save-quota"
        >
          {t('siteDetail.sysadmin.quotaSave')}
        </M3Button>
      </Box>
    </Box>
  );
}
