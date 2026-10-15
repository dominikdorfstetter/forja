import type { ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface PickerSearchResultsProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  /** Extra styles for the search field (e.g. spacing when the dialog body doesn't gap its children). */
  searchSx?: SxProps<Theme>;
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  /** `Grid` items, rendered inside the results grid once loaded and non-empty. */
  children: ReactNode;
}

/** Search field + loading / empty / results-grid states shared by the media and document pickers. */
export function PickerSearchResults({
  search,
  onSearchChange,
  placeholder,
  searchSx,
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: PickerSearchResultsProps) {
  return (
    <>
      <TextField
        autoFocus
        placeholder={placeholder}
        size="small"
        fullWidth
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={searchSx}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <PickerResultsBody isLoading={isLoading} isEmpty={isEmpty} emptyMessage={emptyMessage}>
        {children}
      </PickerResultsBody>
    </>
  );
}

function PickerResultsBody({
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: Pick<PickerSearchResultsProps, 'isLoading' | 'isEmpty' | 'emptyMessage' | 'children'>) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isEmpty) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        {emptyMessage}
      </Typography>
    );
  }
  return (
    <Grid container spacing={1.5}>
      {children}
    </Grid>
  );
}
