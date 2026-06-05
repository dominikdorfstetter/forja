import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { Icon } from '@/components/design-system';
import { SearchField } from '@/components/shared/listPageV2';

export interface SettingsNavItem {
  /** Sub-route relative to /site-settings (e.g. '' for Overview, '/ai' for AI). */
  path: string;
  /** Route label (localised). */
  label: string;
  /** Material Symbols Rounded ligature name — consumes the foundation icon. */
  icon: string;
  /** Optional danger styling for destructive zones. */
  danger?: boolean;
}

export interface SettingsNavGroup {
  /** Localised group heading — e.g. "Configuration". */
  label: string;
  items: SettingsNavItem[];
  /** When true, the heading uses the error colour. */
  danger?: boolean;
}

export interface SettingsSidebarProps {
  groups: SettingsNavGroup[];
  /** Sub-path of the currently active item, e.g. '' or '/ai'. */
  currentPath: string;
  onNavigate: (path: string) => void;
  /** Optional header slot shown above the nav (back button, site chip). */
  header?: ReactNode;
}

/**
 * Grouped filterable sidebar for Site Settings. Shape-morph active state
 * (pill 999 -> squircle 14) matches SidebarNav for visual consistency.
 * A filter input narrows the list by substring match across group labels
 * and item labels; an empty-state message shows when no items match.
 */
export function SettingsSidebar({
  groups,
  currentPath,
  onNavigate,
  header,
}: SettingsSidebarProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');

  const normalised = filter.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!normalised) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(normalised) ||
            g.label.toLowerCase().includes(normalised),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, normalised]);

  return (
    <Box
      component="aside"
      aria-label={t('siteSettings.sidebar.label', 'Settings navigation')}
      sx={{
        background: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {header && (
        <Box sx={{ p: 2, borderBottom: '1px solid var(--outline-variant)' }}>{header}</Box>
      )}

      <Box sx={{ px: 2, py: 2, borderBottom: '1px solid var(--outline-variant)' }}>
        <SearchField
          value={filter}
          onChange={setFilter}
          placeholder={t('siteSettings.sidebar.filterPlaceholder', 'Filter menu…')}
          clearAriaLabel={t('common.actions.clear', 'Clear')}
          ariaLabel={t('siteSettings.sidebar.filterPlaceholder', 'Filter menu…')}
          data-testid="site-settings.sidebar.filter"
          fullWidth
        />
      </Box>

      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px 14px',
        }}
      >
        {visibleGroups.length === 0 ? (
          <div
            style={{
              padding: '20px 14px',
              color: 'var(--on-surface-variant)',
              fontSize: 13,
            }}
          >
            {t('siteSettings.sidebar.noMatches', 'No sections match "{{q}}"', {
              q: filter,
            })}
          </div>
        ) : (
          visibleGroups.map((group) => (
            <div key={group.label} style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1.1,
                  color: group.danger ? 'var(--err)' : 'var(--on-surface-variant)',
                  textTransform: 'uppercase',
                  padding: '0 10px 6px',
                }}
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onNavigate(item.path)}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`site-settings.nav.${item.path.replace('/', '') || 'overview'}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '0 10px',
                      height: 38,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      textAlign: 'left',
                      background: active ? 'var(--primary-container)' : 'transparent',
                      color: active
                        ? 'var(--on-primary-container)'
                        : item.danger
                          ? 'var(--err)'
                          : 'var(--on-surface)',
                      borderRadius: active ? 12 : 999,
                      transition: 'var(--motion-shape-morph), background 140ms, color 120ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--surface-container)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      filled={active}
                      color={
                        item.danger && !active ? 'var(--err)' : undefined
                      }
                    />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </nav>
    </Box>
  );
}
