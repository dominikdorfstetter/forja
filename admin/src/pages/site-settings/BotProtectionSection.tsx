import { useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ShieldIcon from '@mui/icons-material/Shield';
import { M3Button, SettingsCard } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingState from '@/components/shared/LoadingState';
import { useRegisterSaveBar } from '@/store/SaveBarContext';
import type { SiteBotProtectionResponse } from '@/types/api';
import BotProtectionEditForm from './BotProtectionEditForm';
import { ALTCHA, ALTCHA_CHALLENGE_URL_TEMPLATE, REMOTE } from './botProtectionModel';
import { useBotProtectionSettings } from './useBotProtectionSettings';

interface BotProtectionSectionProps {
  siteId: string;
}

interface MonoValueProps {
  label: string;
  value: string | null | undefined;
  testId: string;
  hint?: string;
}

/** Caption + monospace value (+ optional hint) row of the saved-config summary. */
function MonoValue({ label, value, testId, hint }: MonoValueProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
        data-testid={testId}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

interface BotProtectionSummaryProps {
  config: SiteBotProtectionResponse;
  onReconfigure: () => void;
  onRegenerateKey: () => void;
  onRemove: () => void;
}

/** Read-only view of a saved bot-protection config with its actions. */
function BotProtectionSummary({ config, onReconfigure, onRegenerateKey, onRemove }: BotProtectionSummaryProps) {
  const { t } = useTranslation();
  const isAltcha = config.mode === ALTCHA;
  const modeLabel =
    config.mode === REMOTE
      ? config.provider_label
      : t('siteSettings.forms.botProtection.mode.altcha', 'ALTCHA (self-hosted)');

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip
          icon={isAltcha ? <ShieldIcon /> : undefined}
          label={t('siteSettings.forms.botProtection.statusConfigured', 'Configured')}
          color="success"
          size="small"
          data-testid="site-settings.forms.bot-protection.status"
        />
        <Typography variant="body2" sx={{ fontWeight: 600 }} data-testid="site-settings.forms.bot-protection.mode-label">
          {modeLabel}
        </Typography>
      </Stack>
      {config.mode === REMOTE && (
        <MonoValue
          label={t('siteSettings.forms.botProtection.verifyUrlLabel', 'Verify URL')}
          value={config.verify_url}
          testId="site-settings.forms.bot-protection.verify-url"
        />
      )}
      {isAltcha && (
        <MonoValue
          label={t('siteSettings.forms.botProtection.altcha.challengeUrlLabel', 'Widget challenge URL')}
          value={ALTCHA_CHALLENGE_URL_TEMPLATE}
          testId="site-settings.forms.bot-protection.challenge-url"
          hint={t(
            'siteSettings.forms.botProtection.altcha.challengeUrlHint',
            "Set your ALTCHA widget's `challenge` to this endpoint on your public API host, replacing <form-slug> with each form's slug.",
          )}
        />
      )}
      <Stack direction="row" spacing={1}>
        <M3Button
          variant="outlined"
          size="sm"
          onClick={onReconfigure}
          data-testid="site-settings.forms.bot-protection.reconfigure"
        >
          {t('siteSettings.forms.botProtection.reconfigure', 'Reconfigure')}
        </M3Button>
        {isAltcha && (
          <M3Button
            variant="outlined"
            size="sm"
            onClick={onRegenerateKey}
            data-testid="site-settings.forms.bot-protection.regenerate-key"
          >
            {t('siteSettings.forms.botProtection.altcha.regenerateKey', 'Regenerate key')}
          </M3Button>
        )}
        <M3Button
          variant="outlined"
          size="sm"
          danger
          onClick={onRemove}
          data-testid="site-settings.forms.bot-protection.remove"
        >
          {t('siteSettings.forms.botProtection.remove', 'Remove')}
        </M3Button>
      </Stack>
    </Stack>
  );
}

/**
 * Per-site bot-protection config (#608, #772). Offers a provider-mode
 * selector that defaults to self-hosted ALTCHA (GDPR-clean, zero-config) and
 * falls back to a custom captcha vendor (the original verify_url + secret
 * fields) when the admin opts in. ALTCHA enablement needs no inputs — the
 * server generates the HMAC key — so the only ALTCHA-mode action is an
 * explicit key rotation.
 */
export default function BotProtectionSection({ siteId }: BotProtectionSectionProps) {
  const { t } = useTranslation();
  const settings = useBotProtectionSettings(siteId);
  const { config, showForm, saving } = settings;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  useRegisterSaveBar('site-settings.forms.bot-protection', {
    visible: showForm && (settings.draft.mode === ALTCHA || settings.isDirty || saving),
    saving: saving || !settings.canSave,
    onSave: settings.save,
    onDiscard: settings.discard,
    saveTestId: 'site-settings.forms.bot-protection.save',
    discardTestId: 'site-settings.forms.bot-protection.discard',
  });

  if (settings.isLoading) {
    return (
      <LoadingState
        label={t('siteSettings.forms.botProtection.loading', 'Loading bot protection settings…')}
      />
    );
  }

  return (
    <SettingsCard data-testid="site-settings.forms.bot-protection.card">
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('siteSettings.forms.botProtection.title', 'Bot protection')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'siteSettings.forms.botProtection.description',
              'Forms marked as Mandatory protection won’t accept submissions until a bot-protection check passes. Self-hosted ALTCHA is the default — no signup, no third-party calls, GDPR-clean. You can switch to a custom captcha vendor if you prefer.',
            )}
          </Typography>
        </Box>

        {settings.isError && (
          <Alert severity="warning" data-testid="site-settings.forms.bot-protection.load-error">
            {t(
              'siteSettings.forms.botProtection.loadError',
              "Couldn't load the current bot-protection settings. You can still configure them below; saving will overwrite whatever is stored.",
            )}
          </Alert>
        )}

        {config && !showForm ? (
          <BotProtectionSummary
            config={config}
            onReconfigure={settings.startEditing}
            onRegenerateKey={() => setRegenOpen(true)}
            onRemove={() => setDeleteOpen(true)}
          />
        ) : (
          <BotProtectionEditForm settings={settings} onRegenerateKey={() => setRegenOpen(true)} />
        )}
      </Stack>

      <ConfirmDialog
        open={deleteOpen}
        title={t('siteSettings.forms.botProtection.deleteConfirm.title', 'Remove bot protection?')}
        message={t(
          'siteSettings.forms.botProtection.deleteConfirm.body',
          'Forms marked as Mandatory will start rejecting submissions until you configure a verifier again.',
        )}
        confirmLabel={t('common.actions.remove', 'Remove')}
        confirmColor="error"
        onConfirm={() => {
          setDeleteOpen(false);
          settings.remove();
        }}
        onCancel={() => setDeleteOpen(false)}
        loading={settings.removing}
      />

      <ConfirmDialog
        open={regenOpen}
        title={t('siteSettings.forms.botProtection.altcha.regenConfirm.title', 'Regenerate ALTCHA key?')}
        message={t(
          'siteSettings.forms.botProtection.altcha.regenConfirm.body',
          'A new signing key is generated immediately. Any challenge a visitor is currently solving becomes invalid and must be re-fetched.',
        )}
        confirmLabel={t('siteSettings.forms.botProtection.altcha.regenerateKey', 'Regenerate key')}
        onConfirm={() => {
          setRegenOpen(false);
          settings.regenerateKey();
        }}
        onCancel={() => setRegenOpen(false)}
        loading={settings.regenerating}
      />
    </SettingsCard>
  );
}
