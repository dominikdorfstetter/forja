import { type ReactNode } from 'react';
import { Box, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { Icon } from '@/components/design-system';

export interface FilterSelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  icon?: string;
}

export interface FilterSelectProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: FilterSelectOption<V>[];
  placeholder?: ReactNode;
  width?: number | string;
  fullWidth?: boolean;
  ariaLabel?: string;
  'data-testid'?: string;
}

/**
 * M3 Expressive pill-shaped filter dropdown. Shares the 999px radius,
 * surface-container-high fill, outline-variant stroke, and 40px height
 * with the SearchField so filter toolbars read as one cohesive row.
 * Thin wrapper over MUI Select — full keyboard/a11y behaviour carries
 * over, we only repaint the chrome and align padding. The popup menu is
 * repainted too: surface-container-high on a 14px card with 10px pill
 * menu items that hover to surface-container-highest.
 */
export function FilterSelect<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  width = 200,
  fullWidth = false,
  ariaLabel,
  ...rest
}: FilterSelectProps<V>) {
  return (
    <Select
      value={value}
      onChange={(e: SelectChangeEvent<unknown>) => onChange(e.target.value as V)}
      displayEmpty
      size="small"
      inputProps={{ 'aria-label': ariaLabel }}
      data-testid={rest['data-testid']}
      sx={{
        minWidth: fullWidth ? undefined : width,
        width: fullWidth ? '100%' : undefined,
        height: 40,
        borderRadius: 999,
        bgcolor: 'var(--surface-container-high)',
        color: 'var(--on-surface)',
        fontSize: 13,
        fontVariationSettings: '"wght" 500, "opsz" 13',
        '& fieldset': { borderColor: 'var(--outline-variant)' },
        '&:hover fieldset': { borderColor: 'var(--outline)' },
        '&.Mui-focused fieldset': { borderColor: 'var(--primary)' },
        '& .MuiSelect-icon': { color: 'var(--on-surface-variant)' },
        '& .MuiSelect-select': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          py: 0,
        },
      }}
      MenuProps={{
        slotProps: {
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: '14px',
              bgcolor: 'var(--surface-container-high)',
              border: '1px solid var(--outline-variant)',
              boxShadow: '0 12px 24px -8px rgb(0 0 0 / 0.4)',
              '& .MuiMenuItem-root': {
                fontSize: 13,
                borderRadius: '10px',
                mx: 0.5,
                my: 0.25,
                minHeight: 36,
                color: 'var(--on-surface)',
                '&:hover': { bgcolor: 'var(--surface-container-highest)' },
                '&.Mui-selected': {
                  bgcolor: 'var(--primary-container)',
                  color: 'var(--on-primary-container)',
                  '&:hover': { bgcolor: 'var(--primary-container)' },
                },
              },
            },
          },
        },
      }}
    >
      {placeholder !== undefined && (
        <MenuItem value="">
          <Box component="span" sx={{ color: 'var(--on-surface-variant)' }}>
            {placeholder}
          </Box>
        </MenuItem>
      )}
      {options.map((opt) => (
        <MenuItem key={String(opt.value)} value={opt.value}>
          {opt.icon && <Icon name={opt.icon} size={16} />}
          {opt.label}
        </MenuItem>
      ))}
    </Select>
  );
}

