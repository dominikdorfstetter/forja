import {
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';

interface MediaSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
}

export default function MediaSearchBar({ searchInput, onSearchChange }: MediaSearchBarProps) {
  const { t } = useTranslation();

  return (
    <TextField
      fullWidth
      size="small"
      placeholder={t('media.searchPlaceholder')}
      value={searchInput}
      onChange={(e) => onSearchChange(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        endAdornment: searchInput ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={{ mb: 2 }}
    />
  );
}
