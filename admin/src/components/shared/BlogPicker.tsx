import { useState, useMemo, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBlogs } from '@/services/blogs';
import { useSiteContext } from '@/store/SiteContext';
import type { BlogListItem } from '@/types/api';

interface BlogPickerProps {
  value: string;
  onChange: (slug: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  siteId?: string;
}

export default function BlogPicker({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  siteId: siteIdProp,
}: BlogPickerProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const siteId = siteIdProp || selectedSiteId;

  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: blogsData, isLoading } = useQuery({
    queryKey: ['blogs-picker', siteId, debouncedSearch],
    queryFn: () => getBlogs(siteId, {
      search: debouncedSearch || undefined,
      page_size: 20,
    }),
    enabled: !!siteId,
    staleTime: 30_000,
  });

  const blogs = useMemo(() => blogsData?.data ?? [], [blogsData]);

  const selectedOption = useMemo<BlogListItem | null>(() => {
    if (!value) return null;
    return blogs.find((b) => b.slug === value) ?? null;
  }, [value, blogs]);

  return (
    <Autocomplete
      data-testid="blog-picker"
      options={blogs}
      value={selectedOption}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
      onChange={(_, newValue) => onChange(newValue?.slug ?? '')}
      getOptionLabel={(option) => option.slug || option.id}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      loading={isLoading}
      disabled={disabled}
      noOptionsText={t('blogs.picker.empty', 'No blog posts found')}
      loadingText={t('blogs.picker.loading', 'Loading blog posts...')}
      filterOptions={(x) => x}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {option.slug || option.id}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {option.author} &middot; {option.status}
            </Typography>
          </Box>
          {option.is_featured && <Chip label={t('common.labels.featured', 'Featured')} size="small" color="primary" variant="outlined" />}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t('blogs.picker.label', 'Select a blog post')}
          placeholder={t('blogs.picker.placeholder', 'Search by slug...')}
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
