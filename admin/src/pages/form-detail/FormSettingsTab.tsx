import { useTranslation } from 'react-i18next';
import { Box, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import type { FormBotProtection, FormStorageMode } from '@/types/api';
import { parseRetentionDays, type SettingsState } from './formDetailModel';

interface FormSettingsTabProps {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

/** Settings tab of the form detail page: identity, consent, bot protection,
 * storage mode and retention. */
export default function FormSettingsTab({ settings, onChange }: FormSettingsTabProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'grid', gap: 2, maxWidth: 720 }}>
      <TextField
        label={t('formsModule.detail.fields.name', 'Name')}
        value={settings.name}
        onChange={(e) => onChange('name', e.target.value)}
        fullWidth
      />
      <TextField
        label={t('formsModule.detail.fields.slug', 'Slug')}
        value={settings.slug}
        onChange={(e) => onChange('slug', e.target.value)}
        fullWidth
      />
      <TextField
        label={t('formsModule.detail.fields.description', 'Description')}
        value={settings.description}
        onChange={(e) => onChange('description', e.target.value)}
        multiline
        minRows={2}
        fullWidth
      />

      <FormControlLabel
        control={
          <Switch
            checked={settings.is_active}
            onChange={(_, v) => onChange('is_active', v)}
            data-testid="forms.detail.toggle.active"
          />
        }
        label={t('formsModule.detail.fields.active', 'Active')}
      />

      <FormControlLabel
        control={
          <Switch
            checked={settings.consent_required}
            onChange={(_, v) => onChange('consent_required', v)}
          />
        }
        label={t('formsModule.detail.fields.consentRequired', 'Require consent checkbox')}
      />

      {settings.consent_required && (
        <TextField
          label={t('formsModule.detail.fields.consentText', 'Consent text')}
          value={settings.consent_text}
          onChange={(e) => onChange('consent_text', e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
      )}

      <TextField
        select
        label={t('formsModule.detail.fields.botProtection', 'Bot protection')}
        value={settings.bot_protection}
        onChange={(e) => onChange('bot_protection', e.target.value as FormBotProtection)}
        fullWidth
      >
        <MenuItem value="none">
          {t('formsModule.detail.botProtection.none', 'None')}
        </MenuItem>
        <MenuItem value="mandatory">
          {t('formsModule.detail.botProtection.mandatory', 'Mandatory')}
        </MenuItem>
      </TextField>

      <TextField
        select
        label={t('formsModule.detail.fields.storageMode', 'Storage mode')}
        value={settings.storage_mode}
        onChange={(e) => onChange('storage_mode', e.target.value as FormStorageMode)}
        helperText={t(
          'formsModule.detail.fields.storageModeHelp',
          'Queryable enables admin-side search across submission data; Simple stores compactly.',
        )}
        fullWidth
      >
        <MenuItem value="simple">
          {t('formsModule.detail.storageMode.simple', 'Simple')}
        </MenuItem>
        <MenuItem value="queryable">
          {t('formsModule.detail.storageMode.queryable', 'Queryable')}
        </MenuItem>
      </TextField>

      <TextField
        label={t('formsModule.detail.fields.retentionDays', 'Retention (days)')}
        value={settings.retention_days}
        onChange={(e) => {
          const parsed = parseRetentionDays(e.target.value);
          if (parsed !== undefined) onChange('retention_days', parsed);
        }}
        type="number"
        inputMode="numeric"
        helperText={t(
          'formsModule.detail.fields.retentionDaysHelp',
          'Leave empty to keep submissions indefinitely. Positive integer auto-deletes after N days.',
        )}
        fullWidth
      />
    </Box>
  );
}
