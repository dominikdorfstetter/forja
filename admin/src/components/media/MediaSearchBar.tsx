import { useTranslation } from 'react-i18next';
import { SearchField } from '@/components/shared/listPageV2/SearchField';

interface MediaSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
}

export default function MediaSearchBar({ searchInput, onSearchChange }: MediaSearchBarProps) {
  const { t } = useTranslation();

  return (
    <SearchField
      value={searchInput}
      onChange={onSearchChange}
      placeholder={t('media.searchPlaceholder')}
      clearAriaLabel={t('common.actions.clear', 'Clear')}
      fullWidth
    />
  );
}
