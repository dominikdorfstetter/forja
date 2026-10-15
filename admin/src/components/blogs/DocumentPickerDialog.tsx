import { useState, useMemo } from 'react';
import {
  Grid,
  CardContent,
  Typography,
  Chip,
  Checkbox,
  Box,
  Link,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useQuery } from '@tanstack/react-query';
import { getDocument, getDocuments } from '@/services/documents';
import { useSiteContext } from '@/store/SiteContext';
import type { DocumentListItem, DocumentResponse } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';
import { getDocumentDisplayName } from '@/components/documents/documentDisplayName';
import { PickerCard, PickerSearchResults } from '@/components/shared/library';

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
    queryKey: queryKeys.documents(selectedSiteId),
    queryFn: () => getDocuments(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });
  // Filter out already-attached documents
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const availableDocuments = useMemo(
    () => (documentListData?.data ?? []).filter((d) => !excludeSet.has(d.id)),
    [documentListData?.data, excludeSet],
  );

  // Fetch details (with localizations) for available documents
  const { data: documentDetails = [], isLoading: isDetailsLoading } = useQuery({
    queryKey: queryKeys.documentDetails(availableDocuments.map((d) => d.id)),
    queryFn: () =>
      Promise.all(availableDocuments.map((d) => getDocument(d.id))),
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

  // Filter by search term
  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return availableDocuments;
    const lower = search.toLowerCase();
    return availableDocuments.filter((doc) => {
      const name = getDocumentDisplayName(doc, detailsMap).toLowerCase();
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

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleAttach}
      icon="attach_file"
      title={t('blogDetail.documents.attach')}
      submitLabel={`${t('blogDetail.documents.attach')} (${selected.size})`}
      submitDisabled={selected.size === 0}
      submitTestId="document-picker.btn.submit"
      cancelTestId="document-picker.btn.cancel"
      maxWidth="md"
      data-testid="document-picker.dialog"
    >
      <PickerSearchResults
        search={search}
        onSearchChange={setSearch}
        placeholder={t('common.actions.search')}
        isLoading={isListLoading || isDetailsLoading}
        isEmpty={filteredDocuments.length === 0}
        emptyMessage={availableDocuments.length === 0
          ? 'No documents available for this site'
          : 'No documents match your search'}
      >
        {filteredDocuments.map((doc) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={doc.id}>
            <PickerCard selected={selected.has(doc.id)} onClick={() => toggleSelection(doc.id)}>
              <DocumentPickerCardContent doc={doc} name={getDocumentDisplayName(doc, detailsMap)} checked={selected.has(doc.id)} />
            </PickerCard>
          </Grid>
        ))}
      </PickerSearchResults>
    </FormDialog>
  );
}

function DocumentPickerCardContent({ doc, name, checked }: { doc: DocumentListItem; name: string; checked: boolean }) {
  return (
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Checkbox
          checked={checked}
          size="small"
          tabIndex={-1}
          sx={{ p: 0, mt: 0.2 }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
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
          <DocumentPickerSource doc={doc} />
        </Box>
      </Box>
    </CardContent>
  );
}

/** Uploaded file name, or the external link (opens in a new tab without toggling selection). */
function DocumentPickerSource({ doc }: { doc: DocumentListItem }) {
  if (doc.has_file) {
    return (
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
    );
  }
  if (!doc.url) return null;
  return (
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
  );
}
