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
import { getLegalDocuments } from '@/services/legal';
import { useSiteContext } from '@/store/SiteContext';
import type { LegalDocumentResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface LegalPickerProps {
  /** Legal document id. */
  value: string;
  onChange: (documentId: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  siteId?: string;
}

const documentLabel = (doc: LegalDocumentResponse) => doc.slug || doc.cookie_name;

export default function LegalPicker({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  siteId: siteIdProp,
}: LegalPickerProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const siteId = siteIdProp || selectedSiteId;

  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: legalData, isLoading } = useQuery({
    queryKey: queryKeys.legalPicker(siteId, debouncedSearch),
    queryFn: () => getLegalDocuments(siteId, {
      search: debouncedSearch || undefined,
      page_size: 50,
    }),
    enabled: !!siteId,
    staleTime: 30_000,
  });

  // Filter out CookieConsent — not a navigable page
  const docs = useMemo(
    () => (legalData?.data ?? []).filter((d) => d.document_type !== 'CookieConsent'),
    [legalData],
  );

  const selectedOption = useMemo<LegalDocumentResponse | null>(() => {
    if (!value) return null;
    return docs.find((d) => d.id === value) ?? null;
  }, [value, docs]);

  return (
    <Autocomplete
      data-testid="legal-picker"
      options={docs}
      value={selectedOption}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
      onChange={(_, newValue) => onChange(newValue?.id ?? '')}
      getOptionLabel={documentLabel}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      loading={isLoading}
      disabled={disabled}
      noOptionsText={t('legal.picker.empty', 'No legal documents found')}
      loadingText={t('legal.picker.loading', 'Loading legal documents...')}
      filterOptions={(x) => x}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {documentLabel(option)}
            </Typography>
          </Box>
          <Chip label={t(`legal.documentTypes.${option.document_type}`)} size="small" variant="outlined" />
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t('legal.picker.label', 'Select a legal document')}
          placeholder={t('legal.picker.placeholder', 'Search legal documents...')}
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
