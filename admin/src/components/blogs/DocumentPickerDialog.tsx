import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Checkbox,
  Box,
  TextField,
  InputAdornment,
  Link,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { DocumentListItem, DocumentResponse } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface DocumentPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onAttach: (documentIds: string[]) => void;
  excludeIds: string[];
}

export default function DocumentPickerDialog({
  open,
  onClose,
  onAttach,
  excludeIds,
}: DocumentPickerDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Fetch the document list for the site
  const { data: documentListData, isLoading: isListLoading } = useQuery({
    queryKey: ['documents', selectedSiteId],
    queryFn: () => apiService.getDocuments(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });
  const documentList = documentListData?.data ?? [];

  // Filter out already-attached documents
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const availableDocuments = useMemo(
    () => documentList.filter((d) => !excludeSet.has(d.id)),
    [documentList, excludeSet],
  );

  // Fetch details (with localizations) for available documents
  const { data: documentDetails = [], isLoading: isDetailsLoading } = useQuery({
    queryKey: ['document-details', availableDocuments.map((d) => d.id)],
    queryFn: () =>
      Promise.all(availableDocuments.map((d) => apiService.getDocument(d.id))),
    enabled: open && availableDocuments.length > 0,
  });

  // Build a map from document id to details for fast lookup
  const detailsMap = useMemo(() => {
    const map = new Map<string, DocumentResponse>();
    for (const detail of documentDetails) {
      map.set(detail.id, detail);
    }
    return map;
  }, [documentDetails]);

  // Get the display name for a document
  const getDocumentName = (doc: DocumentListItem): string => {
    const detail = detailsMap.get(doc.id);
    if (detail && detail.localizations && detail.localizations.length > 0) {
      return detail.localizations[0].name;
    }
    if (doc.has_file && doc.file_name) {
      return doc.file_name;
    }
    if (doc.url) {
      return doc.url.split('/').pop() || 'Untitled';
    }
    return 'Untitled';
  };

  // Filter by search term
  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return availableDocuments;
    const lower = search.toLowerCase();
    return availableDocuments.filter((doc) => {
      const name = getDocumentName(doc).toLowerCase();
      const url = (doc.url || '').toLowerCase();
      const type = doc.document_type.toLowerCase();
      const fileName = (doc.file_name || '').toLowerCase();
      return name.includes(lower) || url.includes(lower) || type.includes(lower) || fileName.includes(lower);
    });
  }, [availableDocuments, search, detailsMap]);

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAttach = () => {
    onAttach(Array.from(selected));
    setSelected(new Set());
    setSearch('');
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  const isLoading = isListLoading || isDetailsLoading;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('blogDetail.documents.attach')}</DialogTitle>
      <DialogContent>
        <TextField
          placeholder={t('common.actions.search')}
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && filteredDocuments.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {availableDocuments.length === 0
              ? 'No documents available for this site'
              : 'No documents match your search'}
          </Typography>
        )}

        {!isLoading && filteredDocuments.length > 0 && (
          <Grid container spacing={1.5}>
            {filteredDocuments.map((doc) => {
              const isSelected = selected.has(doc.id);
              const name = getDocumentName(doc);
              return (
                <Grid item xs={12} sm={6} md={4} key={doc.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <CardActionArea onClick={() => toggleSelection(doc.id)}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Checkbox
                            checked={isSelected}
                            size="small"
                            tabIndex={-1}
                            sx={{ p: 0, mt: 0.2 }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Chip
                                label={doc.document_type}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                              {doc.has_file && (
                                <Chip
                                  label="File"
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                  sx={{ fontSize: '0.6rem', height: 16 }}
                                />
                              )}
                            </Box>
                            {doc.has_file ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.3,
                                  mt: 0.5,
                                }}
                              >
                                <UploadFileIcon sx={{ fontSize: 12 }} />
                                {doc.file_name}
                              </Typography>
                            ) : doc.url ? (
                              <Link
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="caption"
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.3,
                                  mt: 0.5,
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <LinkIcon sx={{ fontSize: 12 }} />
                                {doc.url}
                              </Link>
                            ) : null}
                          </Box>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleAttach}
          disabled={selected.size === 0}
        >
          {t('blogDetail.documents.attach')} ({selected.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
