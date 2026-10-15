import {
  Alert,
  Box,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ShieldIcon from '@mui/icons-material/Shield';
import { M3Button } from '@/components/design-system';
import type { BotProtectionMode } from '@/types/api';
import {
  ALTCHA,
  ALTCHA_CHALLENGE_URL_TEMPLATE,
  REMOTE,
  type BotProtectionValidationError,
} from './botProtectionModel';
import type { BotProtectionSettings } from './useBotProtectionSettings';

/** i18n key + English fallback per validation error code. */
const VALIDATION_MESSAGES: Record<BotProtectionValidationError, [string, string]> = {
  labelRequired: ['siteSettings.forms.botProtection.errors.labelRequired', 'Provider label is required.'],
  urlRequired: ['siteSettings.forms.botProtection.errors.urlRequired', 'Verify URL is required.'],
  urlScheme: ['siteSettings.forms.botProtection.errors.urlScheme', 'Verify URL must use http or https.'],
  urlInvalid: ['siteSettings.forms.botProtection.errors.urlInvalid', 'Verify URL is not a valid URL.'],
  secretRequired: [
    'siteSettings.forms.botProtection.errors.secretRequired',
    'Secret is required (re-enter it whenever you save).',
  ],
};

interface BotProtectionEditFormProps {
  settings: BotProtectionSettings;
  onRegenerateKey: () => void;
}

interface AltchaInfoProps {
  /** Whether a saved ALTCHA config exists (enables inline key rotation). */
  canRegenerate: boolean;
  onRegenerateKey: () => void;
}

function AltchaInfo({ canRegenerate, onRegenerateKey }: AltchaInfoProps) {
  const { t } = useTranslation();
  return (
    <Alert
      severity="success"
      icon={<ShieldIcon />}
      data-testid="site-settings.forms.bot-protection.altcha-info"
    >
      {t(
        'siteSettings.forms.botProtection.altcha.description',
        'Self-hosted proof-of-work. No account, no third-party requests, no cookies — visitor data never leaves your infrastructure. The signing key is generated and stored encrypted on save.',
      )}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          {t(
            'siteSettings.forms.botProtection.altcha.challengeUrlHint',
            "Set your ALTCHA widget's `challenge` to this endpoint on your public API host, replacing <form-slug> with each form's slug.",
          )}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
          data-testid="site-settings.forms.bot-protection.challenge-url-hint"
        >
          {ALTCHA_CHALLENGE_URL_TEMPLATE}
        </Typography>
      </Box>
      {canRegenerate && (
        <Box sx={{ mt: 1 }}>
          <M3Button
            variant="text"
            size="sm"
            onClick={onRegenerateKey}
            data-testid="site-settings.forms.bot-protection.regenerate-key-inline"
          >
            {t('siteSettings.forms.botProtection.altcha.regenerateKey', 'Regenerate key')}
          </M3Button>
        </Box>
      )}
    </Alert>
  );
}

function SecretVisibilityToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <InputAdornment position="end">
      <IconButton
        onClick={onToggle}
        edge="end"
        size="small"
        aria-label={
          shown
            ? t('common.actions.hideSecret', 'Hide secret')
            : t('common.actions.showSecret', 'Show secret')
        }
        data-testid="site-settings.forms.bot-protection.toggle-secret"
      >
        {shown ? (
          <VisibilityOffIcon fontSize="small" />
        ) : (
          <VisibilityIcon fontSize="small" />
        )}
      </IconButton>
    </InputAdornment>
  );
}

function ValidationAlert({ error }: { error: BotProtectionValidationError }) {
  const { t } = useTranslation();
  const [key, fallback] = VALIDATION_MESSAGES[error];
  return (
    <Alert
      severity="warning"
      data-testid="site-settings.forms.bot-protection.validation-error"
    >
      {t(key, fallback)}
    </Alert>
  );
}

/** Custom captcha vendor inputs: label, siteverify URL and secret. */
function RemoteVendorFields({ settings }: { settings: BotProtectionSettings }) {
  const { t } = useTranslation();
  const { config, draft, changeField, showSecret, validationError } = settings;

  return (
    <>
      {config && (
        <Alert severity="info" data-testid="site-settings.forms.bot-protection.reenter-secret">
          {t(
            'siteSettings.forms.botProtection.reenterSecret',
            'For security the secret is never read back. Re-enter it to save any changes.',
          )}
        </Alert>
      )}
      <TextField
        label={t('siteSettings.forms.botProtection.fields.label', 'Provider label')}
        helperText={t(
          'siteSettings.forms.botProtection.fields.labelHelp',
          'Free-text label shown in the admin UI (e.g. "Turnstile"). Not used to pick a provider — the URL is.',
        )}
        value={draft.providerLabel}
        onChange={(e) => changeField('providerLabel', e.target.value)}
        fullWidth
        size="small"
        slotProps={{
          htmlInput: {
            maxLength: 100,
            'data-testid': 'site-settings.forms.bot-protection.label-input',
          },
        }}
      />
      <TextField
        inputRef={settings.verifyUrlRef}
        label={t('siteSettings.forms.botProtection.fields.verifyUrl', 'Verify URL')}
        helperText={t(
          'siteSettings.forms.botProtection.fields.verifyUrlHelp',
          "The vendor's server-side siteverify endpoint. Forja POSTs `secret`+`response` here on every Mandatory-protected submission.",
        )}
        value={draft.verifyUrl}
        onChange={(e) => changeField('verifyUrl', e.target.value)}
        fullWidth
        size="small"
        placeholder="https://challenges.cloudflare.com/turnstile/v0/siteverify"
        slotProps={{
          htmlInput: {
            maxLength: 500,
            inputMode: 'url',
            'data-testid': 'site-settings.forms.bot-protection.url-input',
          },
        }}
      />
      <TextField
        label={t('siteSettings.forms.botProtection.fields.secret', 'Secret')}
        helperText={t(
          'siteSettings.forms.botProtection.fields.secretHelp',
          'Per-site secret issued by your captcha vendor. Stored encrypted at rest.',
        )}
        type={showSecret ? 'text' : 'password'}
        value={draft.secret}
        onChange={(e) => changeField('secret', e.target.value)}
        fullWidth
        size="small"
        slotProps={{
          htmlInput: {
            maxLength: 500,
            'data-testid': 'site-settings.forms.bot-protection.secret-input',
          },
          input: {
            endAdornment: <SecretVisibilityToggle shown={showSecret} onToggle={settings.toggleShowSecret} />,
          },
        }}
      />
      {validationError && <ValidationAlert error={validationError} />}
    </>
  );
}

/** Bot-protection edit form: provider-mode select, then ALTCHA info or the
 * vendor fields, plus "cancel reconfigure" when a saved config exists. */
export default function BotProtectionEditForm({ settings, onRegenerateKey }: BotProtectionEditFormProps) {
  const { t } = useTranslation();
  const { config, draft } = settings;

  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel id="bot-protection-mode-label">
          {t('siteSettings.forms.botProtection.mode.label', 'Provider')}
        </InputLabel>
        <Select
          labelId="bot-protection-mode-label"
          label={t('siteSettings.forms.botProtection.mode.label', 'Provider')}
          value={draft.mode}
          onChange={(e) => settings.changeMode(e.target.value as BotProtectionMode)}
          data-testid="site-settings.forms.bot-protection.mode-select"
        >
          <MenuItem value={ALTCHA}>
            {t('siteSettings.forms.botProtection.mode.altchaRecommended', 'ALTCHA (self-hosted) — recommended')}
          </MenuItem>
          <MenuItem value={REMOTE}>
            {t('siteSettings.forms.botProtection.mode.remote', 'Custom captcha vendor')}
          </MenuItem>
        </Select>
      </FormControl>

      {draft.mode === ALTCHA ? (
        <AltchaInfo canRegenerate={config?.mode === ALTCHA} onRegenerateKey={onRegenerateKey} />
      ) : (
        <RemoteVendorFields settings={settings} />
      )}

      {config && (
        <Stack direction="row" spacing={1}>
          <M3Button
            variant="text"
            size="sm"
            onClick={() => settings.discard()}
            data-testid="site-settings.forms.bot-protection.cancel-reconfigure"
          >
            {t('common.actions.cancel', 'Cancel')}
          </M3Button>
        </Stack>
      )}
    </Stack>
  );
}
