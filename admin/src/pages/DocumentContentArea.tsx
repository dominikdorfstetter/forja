import {
  Box,
  Alert,
  Typography,
  TablePagination,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import { M3Button } from '@/components/design-system';
import { SearchField } from '@/components/shared/listPageV2/SearchField';
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
  onPrivacy?: (doc: DocumentListItem) => void;
  onUnlock?: (doc: DocumentListItem) => void;
  onOpenCreate: () => void;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  detailError: boolean;
  activeDoc: DocumentListItem | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
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
  onPrivacy,
  onUnlock,
  onOpenCreate,
  meta,
  onPageChange,
  onPageSizeChange,
  detailError,
  activeDoc,
  t,
  selectedIds,
  onToggleSelect,
}: DocumentContentAreaProps) {
  return (
    <>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
          <Box sx={{ flex: '1 1 auto', maxWidth: 520 }}>
            <SearchField
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={t('documents.searchPlaceholder')}
              clearAriaLabel={t('common.actions.clear')}
              fullWidth
            />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {canWrite && (
            <M3Button
              variant="filled"
              icon="add"
              onClick={onOpenCreate}
              data-testid="documents-add-button"
            >
              {t('documents.createButton')}
            </M3Button>
          )}
        </Box>

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
            onPrivacy={onPrivacy}
            onUnlock={onUnlock}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        )}

        {meta && (
          <TablePagination
            component="div"
            count={meta.total_items}
            page={meta.page - 1}
            onPageChange={(_, p) => onPageChange(p + 1)}
            rowsPerPage={meta.page_size}
            onRowsPerPageChange={(e) => onPageSizeChange(+e.target.value)}
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: '14px',
              bgcolor: 'var(--surface-container-highest)',
              border: '1px solid var(--primary)',
              boxShadow: '0 12px 24px -6px rgb(0 0 0 / 0.45)',
              maxWidth: 240,
              pointerEvents: 'none',
              color: 'var(--on-surface)',
            }}
          >
            <ArticleIcon fontSize="small" sx={{ color: 'var(--primary)' }} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontVariationSettings: '"wght" 600, "opsz" 14' }}>
              {getDocumentDisplayName(activeDoc, detailMap)}
            </Typography>
          </Box>
        ) : null}
      </DragOverlay>
    </>
  );
}
