import { useState, useMemo, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPage, getPages } from '@/services/pages';
import { useSiteContext } from '@/store/SiteContext';
import PageTypeChip from '@/components/shared/PageTypeChip';
import type { PageListItem, PageResponse } from '@/types/api';

interface PagePickerProps {
  value: string;
  onChange: (pageId: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  siteId?: string;
}

/** Convert a full PageResponse to the lighter PageListItem shape. */
function toListItem(page: PageResponse): PageListItem {
  return {
    id: page.id,
    route: page.route,
    page_type: page.page_type,
    slug: page.slug,
    is_in_navigation: page.is_in_navigation,
    status: page.status,
    created_at: page.created_at,
  };
}

export default function PagePicker({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  siteId: siteIdProp,
}: PagePickerProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const siteId = siteIdProp || selectedSiteId;

  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch pages matching search
  const { data: pagesData, isLoading } = useQuery({
    queryKey: ['pages-picker', siteId, debouncedSearch],
    queryFn: () => getPages(siteId, {
      search: debouncedSearch || undefined,
      page_size: 20,
    }),
    enabled: !!siteId,
    staleTime: 30_000,
  });

  const pages = useMemo(() => pagesData?.data ?? [], [pagesData]);

  // When editing, fetch the selected page if it's not in the results
  const needsSingleFetch = !!value && !pages.find((p) => p.id === value);
  const { data: singlePage } = useQuery({
    queryKey: ['page', value],
    queryFn: () => getPage(value),
    enabled: needsSingleFetch,
    staleTime: 60_000,
  });

  // Build the selected option
  const selectedOption = useMemo<PageListItem | null>(() => {
    if (!value) return null;
    const fromList = pages.find((p) => p.id === value);
    if (fromList) return fromList;
    if (singlePage) return toListItem(singlePage);
    return null;
  }, [value, pages, singlePage]);

  // Merge the selected page into options if not already present
  const options = useMemo<PageListItem[]>(() => {
    if (!selectedOption || pages.find((p) => p.id === selectedOption.id)) {
      return pages;
    }
    return [selectedOption, ...pages];
  }, [pages, selectedOption]);

  return (
    <Autocomplete
      data-testid="page-picker"
      options={options}
      value={selectedOption}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
      onChange={(_, newValue) => onChange(newValue?.id ?? '')}
      getOptionLabel={(option) => option.route || option.slug || option.id}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      loading={isLoading}
      disabled={disabled}
      noOptionsText={t('pages.picker.empty', 'No pages found')}
      loadingText={t('pages.picker.loading', 'Loading pages...')}
      filterOptions={(x) => x}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>{option.route}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {option.slug ?? ''} &middot; {option.status}
            </Typography>
          </Box>
          <PageTypeChip value={option.page_type} size="small" />
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t('pages.picker.label', 'Select a page')}
          placeholder={t('pages.picker.placeholder', 'Search by title or route...')}
          error={error}
          helperText={helperText}
          slotProps={{
            ...params.slotProps,

            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            }
          }}
        />
      )}
    />
  );
}
