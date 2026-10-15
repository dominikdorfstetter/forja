import { Alert, Box, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SectionHead } from '@/components/design-system';
import { useSiteContext } from '@/store/SiteContext';
import BotProtectionSection from './BotProtectionSection';

/**
 * Forms-wide site settings (#608). Currently hosts the bot-protection
 * verifier config; the page is intentionally split out as its own
 * `/site-settings/forms` route so future forms-level settings (default
 * retention, notification routing, default consent text, ...) have a
 * stable home.
 *
 * Bot protection is vendor-agnostic by design — the admin pastes their
 * captcha provider's siteverify URL and per-site secret, and Forja
 * forwards tokens to whatever URL they configured. See the inline help
 * for the contract.
 */
export default function FormsSettingsPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  if (!selectedSiteId) {
    return (
      <Alert severity="info" data-testid="forms-settings.no-site">
        {t('settings.selectSiteAlert')}
      </Alert>
    );
  }

  return (
    <Box data-testid="site-settings.forms.page">
      <SectionHead
        icon="dynamic_form"
        title={t('siteSettings.forms.title', 'Forms')}
        subtitle={t(
          'siteSettings.forms.subtitle',
          'Site-wide settings that apply to every form on this site.',
        )}
      />
      <Stack spacing={3}>
        <BotProtectionSection siteId={selectedSiteId} />
      </Stack>
    </Box>
  );
}
