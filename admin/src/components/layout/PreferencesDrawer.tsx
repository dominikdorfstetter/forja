import {
  Box,
  Drawer,
  Typography,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { type Density, useThemeMode } from '@/theme/ThemeContext';
import { type Accent, resolveAccent } from '@/theme/m3ExpressiveTokens';
import { FilterSelect } from '@/components/shared/listPageV2';
import { Icon, M3IconButton } from '@/components/design-system';

const ACCENT_KEYS: Accent[] = ['violet', 'coral', 'teal', 'amber'];

interface PreferencesDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Section heading with an M3 tonal tile. Groups the drawer into visually
 * distinct chunks without relying on bolded labels + icons which previously
 * looked like MUI form-group headers.
 */
function SectionHeading({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 28,
            height: 28,
            borderRadius: '9px',
            bgcolor: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={16} />
        </Box>
        <Typography
          component="h3"
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 600, "opsz" 14',
          }}
        >
          {title}
        </Typography>
      </Box>
      {description && (
        <Typography
          sx={{
            mt: 0.5,
            fontSize: 12,
            color: 'var(--on-surface-variant)',
            ml: 4.5,
          }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}

export default function PreferencesDrawer({ open, onClose }: PreferencesDrawerProps) {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { themeId, options: themeOptions, resolvedFlavor, accent, setAccent, density, setDensity } =
    useThemeMode();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      data-testid="preferences-drawer"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
      slotProps={{
        paper: {
          sx: {
            width: 380,
            p: 3,
            bgcolor: 'var(--surface-container-low)',
            border: 'none',
            borderLeft: '1px solid var(--outline-variant)',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 700, "opsz" 20',
            letterSpacing: -0.2,
          }}
        >
          {t('settings.preferences.title')}
        </Typography>
        <M3IconButton
          name="close"
          size={36}
          tooltip={t('common.actions.close')}
          onClick={onClose}
          data-testid="preferences-drawer-close"
        />
      </Box>
      <Stack spacing={2.5} divider={<Divider sx={{ borderColor: 'var(--outline-variant)' }} />}>
        {/* Language */}
        <Box>
          <SectionHeading icon="language" title={t('settings.preferences.language.title')} />
          <FilterSelect
            value={preferences.language}
            onChange={(value) => updatePreferences({ language: value })}
            options={SUPPORTED_LANGUAGES.map((lang) => ({
              value: lang.code,
              label: `${lang.nativeName} (${lang.name})`,
            }))}
            fullWidth
            ariaLabel={t('settings.preferences.language.label')}
            data-testid="preferences-language"
          />
        </Box>

        {/* Theme */}
        <Box>
          <SectionHeading icon="palette" title={t('settings.preferences.theme.title')} />
          <FilterSelect
            value={themeId}
            onChange={(value) => updatePreferences({ theme_id: value })}
            options={themeOptions.map((opt) => ({
              value: opt.id,
              label: `${opt.label}${opt.mode !== 'system' ? ` (${opt.mode})` : ''}`,
            }))}
            fullWidth
            ariaLabel={t('settings.preferences.theme.label')}
            data-testid="preferences-theme"
          />
        </Box>

        <Box>
          <SectionHeading
            icon="palette"
            title={t('settings.preferences.accent.title')}
            description={t('settings.preferences.accent.description')}
          />
          <Stack direction="row" spacing={1.5} role="radiogroup" aria-label={t('settings.preferences.accent.label')} sx={{ ml: 4.5, mt: 0.5 }}>
            {ACCENT_KEYS.map((key) => {
              const selected = accent === key;
              // Preview the swatch in the color that would actually apply
              // under the currently active flavor — so under Mocha the
              // violet swatch shows Mocha's mauve, not M3 Dark's violet.
              const swatchColor = resolveAccent(resolvedFlavor, key).primary;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(`settings.preferences.accent.${key}`)}
                  onClick={() => setAccent(key)}
                  data-testid={`preferences-accent-${key}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: swatchColor,
                    border: selected ? '2px solid var(--on-surface)' : '2px solid transparent',
                    boxShadow: selected ? '0 0 0 2px var(--surface-container-high)' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'var(--motion-press-scale), box-shadow 120ms cubic-bezier(0.2, 0, 0, 1)',
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        {/* Density */}
        <Box>
          <SectionHeading
            icon="tune"
            title={t('settings.preferences.density.title')}
            description={t('settings.preferences.density.description')}
          />
          <ToggleButtonGroup
            value={density}
            exclusive
            onChange={(_, v: Density | null) => {
              if (v) setDensity(v);
            }}
            size="small"
            data-testid="preferences-density"
            sx={{
              ml: 4.5,
              bgcolor: 'var(--surface-container-high)',
              borderRadius: '999px',
              p: 0.25,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '999px',
                textTransform: 'uppercase',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.8,
                px: 1.5,
                py: 0.5,
                color: 'var(--on-surface-variant)',
                '&.Mui-selected': {
                  bgcolor: 'var(--primary-container)',
                  color: 'var(--on-primary-container)',
                  '&:hover': { bgcolor: 'var(--primary-container)' },
                },
              },
            }}
          >
            <ToggleButton value="comfortable" aria-label={t('settings.preferences.density.comfortable')}>
              {t('settings.preferences.density.comfortable')}
            </ToggleButton>
            <ToggleButton value="compact" aria-label={t('settings.preferences.density.compact')}>
              {t('settings.preferences.density.compact')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Table Display */}
        <Box>
          <SectionHeading icon="table_chart" title={t('settings.preferences.tableDisplay.title')} />
          <FilterSelect
            value={String(preferences.page_size)}
            onChange={(value) => {
              const n = Number(value);
              if (n !== preferences.page_size) updatePreferences({ page_size: n });
            }}
            options={[10, 25, 50, 100].map((size) => ({ value: String(size), label: String(size) }))}
            fullWidth
            ariaLabel={t('settings.preferences.tableDisplay.pageSizeLabel')}
            data-testid="preferences-page-size"
          />
        </Box>
      </Stack>
    </Drawer>
  );
}
