import {
  Box,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  TablePagination,
  Paper,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { DragOverlay } from '@dnd-kit/core';
import type { DocumentListItem, DocumentResponse, PaginationMeta } from '@/types/api';
import EmptyState from '@/components/shared/EmptyState';
import DocumentCardGrid, { getDocumentDisplayName } from '@/pages/DocumentCardGrid';

interface DocumentContentAreaProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredDocuments: DocumentListItem[] | undefined;
  detailMap: Map<string, DocumentResponse>;
  canWrite: boolean;
  isAdmin: boolean;
  onDownload: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  onOpenCreate: () => void;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  detailError: boolean;
  activeDoc: DocumentListItem | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export default function DocumentContentArea({
  searchQuery,
  onSearchChange,
  filteredDocuments,
  detailMap,
  canWrite,
  isAdmin,
  onDownload,
  onEdit,
  onDelete,
  onOpenCreate,
  meta,
  onPageChange,
  onPerPageChange,
  detailError,
  activeDoc,
  t,
}: DocumentContentAreaProps) {
  return (
    <>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, filename, URL, or type..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 2 }}
        />

        {!filteredDocuments || filteredDocuments.length === 0 ? (
          <EmptyState
            icon={<ArticleIcon sx={{ fontSize: 64 }} />}
            title={t('documents.empty.title')}
            description={t('documents.empty.description')}
            action={
              !searchQuery && canWrite
                ? { label: t('documents.createButton'), onClick: onOpenCreate }
                : undefined
            }
          />
        ) : (
          <DocumentCardGrid
            documents={filteredDocuments}
            detailMap={detailMap}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onDownload={onDownload}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}

        {meta && (
          <TablePagination
            component="div"
            count={meta.total_items}
            page={meta.page - 1}
            onPageChange={(_, p) => onPageChange(p + 1)}
            rowsPerPage={meta.page_size}
            onRowsPerPageChange={(e) => onPerPageChange(+e.target.value)}
            rowsPerPageOptions={[10, 25, 50]}
          />
        )}

        {detailError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Some document details could not be loaded.
          </Alert>
        )}
      </Box>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeDoc ? (
          <Paper
            elevation={12}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'primary.main',
              maxWidth: 220,
              pointerEvents: 'none',
            }}
          >
            <ArticleIcon fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight={500} noWrap>{getDocumentDisplayName(activeDoc, detailMap)}</Typography>
          </Paper>
        ) : null}
      </DragOverlay>
    </>
  );
}
