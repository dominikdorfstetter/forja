import { useState, useRef, useCallback } from 'react';
import {
  Alert,
  Box,
  Chip,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ShieldIcon from '@mui/icons-material/Shield';
import { M3Button, SectionHead, SettingsCard } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingState from '@/components/shared/LoadingState';
import { useRegisterSaveBar } from '@/store/SaveBarContext';
import { useSiteContext } from '@/store/SiteContext';
import { deleteSiteBotProtection, getSiteBotProtection, upsertSiteBotProtection } from '@/services/botProtection';
import type { BotProtectionMode, SiteBotProtectionResponse } from '@/types/api';

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

interface BotProtectionSectionProps {
  siteId: string;
}

const ALTCHA: BotProtectionMode = 'altcha';
const REMOTE: BotProtectionMode = 'remote';

/** Path the ALTCHA widget fetches a challenge from (per form, on the public
 *  API host). Shown to admins so they can wire up their widget. */
const ALTCHA_CHALLENGE_URL_TEMPLATE = '/api/v1/public/forms/<form-slug>/altcha-challenge';

/**
 * Per-site bot-protection config (#608, #772). Offers a provider-mode
 * selector that defaults to self-hosted ALTCHA (GDPR-clean, zero-config) and
 * falls back to a custom captcha vendor (the original verify_url + secret
 * fields) when the admin opts in. ALTCHA enablement needs no inputs — the
 * server generates the HMAC key — so the only ALTCHA-mode action is an
 * explicit key rotation.
 */
function BotProtectionSection({ siteId }: BotProtectionSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const queryKey = ['site-bot-protection', siteId] as const;
  const { data: config, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getSiteBotProtection(siteId),
    enabled: !!siteId,
  });

  const [mode, setMode] = useState<BotProtectionMode>(ALTCHA);
  const [providerLabel, setProviderLabel] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Focus the first revealed remote field when the admin switches to vendor
  // mode (a11y: keep keyboard users oriented after the layout changes).
  const verifyUrlRef = useRef<HTMLInputElement>(null);

  // When the loaded config changes, reset the form. The ref guard keeps us
  // from clobbering edits on background refetches.
  const prevConfigRef = useRef<SiteBotProtectionResponse | null | undefined>(undefined);
  if (config !== prevConfigRef.current) {
    prevConfigRef.current = config;
    setMode(config?.mode ?? ALTCHA);
    setProviderLabel(config?.provider_label ?? '');
    setVerifyUrl(config?.verify_url ?? '');
    setSecret('');
    setEditing(!config); // unconfigured sites land straight into edit mode
    setIsDirty(false);
  }

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertSiteBotProtection(
        siteId,
        mode === ALTCHA
          ? { mode: ALTCHA }
          : {
              mode: REMOTE,
              provider_label: providerLabel.trim(),
              verify_url: verifyUrl.trim(),
              secret: secret.trim(),
            },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setSecret('');
      setIsDirty(false);
      setEditing(false);
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.saved', 'Bot protection saved.'),
        { variant: 'success' },
      );
    },
    onError: () => {
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.saveFailed', 'Saving bot protection failed.'),
        { variant: 'error' },
      );
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => upsertSiteBotProtection(siteId, { mode: ALTCHA, regenerate_key: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.altcha.keyRegenerated', 'ALTCHA key regenerated.'),
        { variant: 'success' },
      );
    },
    onError: () => {
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.altcha.keyRegenerateFailed', 'Regenerating the key failed.'),
        { variant: 'error' },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSiteBotProtection(siteId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      setMode(ALTCHA);
      setProviderLabel('');
      setVerifyUrl('');
      setSecret('');
      setEditing(true);
      setIsDirty(false);
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.removed', 'Bot protection removed.'),
        { variant: 'success' },
      );
    },
    onError: () => {
      enqueueSnackbar(
        t('siteSettings.forms.botProtection.removeFailed', 'Removing bot protection failed.'),
        { variant: 'error' },
      );
    },
  });

  const handleModeChange = (next: BotProtectionMode) => {
    setMode(next);
    setIsDirty(true);
    if (next === REMOTE) {
      // Defer focus until the revealed fields have rendered.
      requestAnimationFrame(() => verifyUrlRef.current?.focus());
    }
  };

  const handleFieldChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setIsDirty(true);
    };

  // Only the remote (vendor) mode has required, validatable fields. ALTCHA is
  // zero-config, so it never blocks save.
  const validationError = (() => {
    if (mode === ALTCHA) return null;
    if (!isDirty && !editing) return null;
    if (!providerLabel.trim()) {
      return t('siteSettings.forms.botProtection.errors.labelRequired', 'Provider label is required.');
    }
    if (!verifyUrl.trim()) {
      return t('siteSettings.forms.botProtection.errors.urlRequired', 'Verify URL is required.');
    }
    try {
      const u = new URL(verifyUrl.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return t('siteSettings.forms.botProtection.errors.urlScheme', 'Verify URL must use http or https.');
      }
    } catch {
      return t('siteSettings.forms.botProtection.errors.urlInvalid', 'Verify URL is not a valid URL.');
    }
    if (!secret.trim()) {
      return t(
        'siteSettings.forms.botProtection.errors.secretRequired',
        'Secret is required (re-enter it whenever you save).',
      );
    }
    return null;
  })();

  // The edit form is shown whenever there is no *saved* config (unconfigured,
  // or the load errored leaving `config` undefined) or the admin explicitly
  // hit "Reconfigure". Deriving this from the absence of a saved config —
  // rather than the `editing` flag alone — guarantees the save bar appears for
  // a brand-new site even if the GET never resolved to a clean 404.
  const showForm = !config || editing;

  // ALTCHA can always be saved while the form is shown (enabling it needs no
  // input); remote requires valid, dirty fields.
  const canSave = mode === ALTCHA ? showForm : !validationError && isDirty;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    upsertMutation.mutate();
  }, [canSave, upsertMutation]);

  const handleDiscard = useCallback(() => {
    setMode(config?.mode ?? ALTCHA);
    setProviderLabel(config?.provider_label ?? '');
    setVerifyUrl(config?.verify_url ?? '');
    setSecret('');
    setIsDirty(false);
    if (config) setEditing(false);
  }, [config]);

  useRegisterSaveBar('site-settings.forms.bot-protection', {
    visible: showForm && (mode === ALTCHA || isDirty || upsertMutation.isPending),
    saving: upsertMutation.isPending || !canSave,
    onSave: handleSave,
    onDiscard: handleDiscard,
    saveTestId: 'site-settings.forms.bot-protection.save',
    discardTestId: 'site-settings.forms.bot-protection.discard',
  });

  if (isLoading) {
    return (
      <LoadingState
        label={t('siteSettings.forms.botProtection.loading', 'Loading bot protection settings…')}
      />
    );
  }

  const modeLabel =
    config?.mode === REMOTE
      ? config.provider_label
      : t('siteSettings.forms.botProtection.mode.altcha', 'ALTCHA (self-hosted)');

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

        {isError && (
          <Alert severity="warning" data-testid="site-settings.forms.bot-protection.load-error">
            {t(
              'siteSettings.forms.botProtection.loadError',
              "Couldn't load the current bot-protection settings. You can still configure them below; saving will overwrite whatever is stored.",
            )}
          </Alert>
        )}

        {config && !editing ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip
                icon={config.mode === ALTCHA ? <ShieldIcon /> : undefined}
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
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('siteSettings.forms.botProtection.verifyUrlLabel', 'Verify URL')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                  data-testid="site-settings.forms.bot-protection.verify-url"
                >
                  {config.verify_url}
                </Typography>
              </Box>
            )}
            {config.mode === ALTCHA && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('siteSettings.forms.botProtection.altcha.challengeUrlLabel', 'Widget challenge URL')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                  data-testid="site-settings.forms.bot-protection.challenge-url"
                >
                  {ALTCHA_CHALLENGE_URL_TEMPLATE}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'siteSettings.forms.botProtection.altcha.challengeUrlHint',
                    "Set your ALTCHA widget's `challenge` to this endpoint on your public API host, replacing <form-slug> with each form's slug.",
                  )}
                </Typography>
              </Box>
            )}
            <Stack direction="row" spacing={1}>
              <M3Button
                variant="outlined"
                size="sm"
                onClick={() => setEditing(true)}
                data-testid="site-settings.forms.bot-protection.reconfigure"
              >
                {t('siteSettings.forms.botProtection.reconfigure', 'Reconfigure')}
              </M3Button>
              {config.mode === ALTCHA && (
                <M3Button
                  variant="outlined"
                  size="sm"
                  onClick={() => setRegenOpen(true)}
                  data-testid="site-settings.forms.bot-protection.regenerate-key"
                >
                  {t('siteSettings.forms.botProtection.altcha.regenerateKey', 'Regenerate key')}
                </M3Button>
              )}
              <M3Button
                variant="outlined"
                size="sm"
                danger
                onClick={() => setDeleteOpen(true)}
                data-testid="site-settings.forms.bot-protection.remove"
              >
                {t('siteSettings.forms.botProtection.remove', 'Remove')}
              </M3Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="bot-protection-mode-label">
                {t('siteSettings.forms.botProtection.mode.label', 'Provider')}
              </InputLabel>
              <Select
                labelId="bot-protection-mode-label"
                label={t('siteSettings.forms.botProtection.mode.label', 'Provider')}
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as BotProtectionMode)}
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

            {mode === ALTCHA ? (
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
                {config && config.mode === ALTCHA && (
                  <Box sx={{ mt: 1 }}>
                    <M3Button
                      variant="text"
                      size="sm"
                      onClick={() => setRegenOpen(true)}
                      data-testid="site-settings.forms.bot-protection.regenerate-key-inline"
                    >
                      {t('siteSettings.forms.botProtection.altcha.regenerateKey', 'Regenerate key')}
                    </M3Button>
                  </Box>
                )}
              </Alert>
            ) : (
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
                  value={providerLabel}
                  onChange={handleFieldChange(setProviderLabel)}
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
                  inputRef={verifyUrlRef}
                  label={t('siteSettings.forms.botProtection.fields.verifyUrl', 'Verify URL')}
                  helperText={t(
                    'siteSettings.forms.botProtection.fields.verifyUrlHelp',
                    "The vendor's server-side siteverify endpoint. Forja POSTs `secret`+`response` here on every Mandatory-protected submission.",
                  )}
                  value={verifyUrl}
                  onChange={handleFieldChange(setVerifyUrl)}
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
                  value={secret}
                  onChange={handleFieldChange(setSecret)}
                  fullWidth
                  size="small"
                  slotProps={{
                    htmlInput: {
                      maxLength: 500,
                      'data-testid': 'site-settings.forms.bot-protection.secret-input',
                    },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowSecret((s) => !s)}
                            edge="end"
                            size="small"
                            aria-label={
                              showSecret
                                ? t('common.actions.hideSecret', 'Hide secret')
                                : t('common.actions.showSecret', 'Show secret')
                            }
                            data-testid="site-settings.forms.bot-protection.toggle-secret"
                          >
                            {showSecret ? (
                              <VisibilityOffIcon fontSize="small" />
                            ) : (
                              <VisibilityIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                {validationError && (
                  <Alert
                    severity="warning"
                    data-testid="site-settings.forms.bot-protection.validation-error"
                  >
                    {validationError}
                  </Alert>
                )}
              </>
            )}

            {config && (
              <Stack direction="row" spacing={1}>
                <M3Button
                  variant="text"
                  size="sm"
                  onClick={() => handleDiscard()}
                  data-testid="site-settings.forms.bot-protection.cancel-reconfigure"
                >
                  {t('common.actions.cancel', 'Cancel')}
                </M3Button>
              </Stack>
            )}
          </Stack>
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
          deleteMutation.mutate();
        }}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
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
          regenerateMutation.mutate();
        }}
        onCancel={() => setRegenOpen(false)}
        loading={regenerateMutation.isPending}
      />
    </SettingsCard>
  );
}
