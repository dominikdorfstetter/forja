import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  TextField,
  Switch,
  InputAdornment,
  Grid,
  MenuItem,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import TableChartIcon from '@mui/icons-material/TableChart';
import PaletteIcon from '@mui/icons-material/Palette';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useThemeMode } from '@/theme/ThemeContext';

export default function PreferencesTab() {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { themeId, options: themeOptions } = useThemeMode();

  return (
    <Grid container spacing={3}>
      {/* Language */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LanguageIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.language.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.language.label')}
            value={preferences.language}
            onChange={(e) => updatePreferences({ language: e.target.value })}
            fullWidth
            size="small"
            helperText={t('settings.preferences.language.description')}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>

      {/* Theme */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PaletteIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.theme.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.theme.label')}
            value={themeId}
            onChange={(e) => updatePreferences({ theme_id: e.target.value })}
            fullWidth
            size="small"
            helperText={t('settings.preferences.theme.description')}
          >
            {themeOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label} {opt.mode !== 'system' ? `(${opt.mode})` : ''}
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>

      {/* Autosave */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SaveAltIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.autosave.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body1">{t('settings.preferences.autosave.enableLabel')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settings.preferences.autosave.enableDescription')}
                </Typography>
              </Box>
              <Switch
                checked={preferences.autosave_enabled}
                onChange={(e) => updatePreferences({ autosave_enabled: e.target.checked })}
              />
            </Stack>

            <TextField
              type="number"
              label={t('settings.preferences.autosave.debounceLabel')}
              helperText={t('settings.preferences.autosave.debounceDescription')}
              size="small"
              fullWidth
              disabled={!preferences.autosave_enabled}
              defaultValue={preferences.autosave_debounce_seconds}
              key={preferences.autosave_debounce_seconds}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">{t('settings.preferences.autosave.seconds')}</InputAdornment>,
                },
                htmlInput: { min: 1, max: 60 },
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 60 && val !== preferences.autosave_debounce_seconds) {
                  updatePreferences({ autosave_debounce_seconds: val });
                }
              }}
            />
          </Stack>
        </Paper>
      </Grid>

      {/* Table Display */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TableChartIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.tableDisplay.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.tableDisplay.pageSizeLabel')}
            helperText={t('settings.preferences.tableDisplay.pageSizeDescription')}
            size="small"
            fullWidth
            value={preferences.page_size}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val !== preferences.page_size) {
                updatePreferences({ page_size: val });
              }
            }}
          >
            {[10, 25, 50, 100].map((size) => (
              <MenuItem key={size} value={size}>{size}</MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>
    </Grid>
  );
}
