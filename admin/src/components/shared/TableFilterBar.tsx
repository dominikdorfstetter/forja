import { Box, Stack, TextField, InputAdornment, IconButton, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}

interface TableFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  testIdPrefix?: string;
  hideSearch?: boolean;
  /** Optional action element rendered at the far right of the bar */
  actions?: React.ReactNode;
}

export default function TableFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  testIdPrefix,
  hideSearch,
  actions,
}: TableFilterBarProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        {!hideSearch && (
          <TextField
            size="small"
            variant="outlined"
            placeholder={searchPlaceholder ?? t('common.actions.search')}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchValue ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => onSearchChange('')}
                      aria-label={t('common.actions.clear')}
                      {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}.search.clear` } : {})}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },

              htmlInput: {
                'aria-label': searchPlaceholder ?? t('common.actions.search'),
              }
            }}
            sx={{ minWidth: 280, flex: 1, maxWidth: 400 }}
            {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}.search.input` } : {})} />
        )}
        {filters && filters.length > 0 && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {filters.map((filter) => (
              <TextField
                key={filter.key}
                select
                size="small"
                label={filter.label}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                sx={{ minWidth: 150 }}
                {...(filter.testId ? { 'data-testid': filter.testId } : {})}
              >
                {filter.options.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        )}
        {actions && (
          <Box sx={{ ml: 'auto' }}>
            {actions}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
