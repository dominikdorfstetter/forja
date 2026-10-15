import {
  Box,
  Alert,
  TablePagination,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import { M3Button } from '@/components/design-system';
import { SearchField } from '@/components/shared/listPageV2/SearchField';
import { DragPreviewCard } from '@/components/shared/listPageV2';
import { DragOverlay } from '@dnd-kit/core';
import type { DocumentListItem, PaginationMeta } from '@/types/api';
import EmptyState from '@/components/shared/EmptyState';
import DocumentCardGrid, { type DocumentCardGridProps } from '@/pages/DocumentCardGrid';
import { getDocumentDisplayName } from '@/components/documents/documentDisplayName';

interface DocumentContentAreaProps extends Omit<DocumentCardGridProps, 'documents'> {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredDocuments: DocumentListItem[] | undefined;
  onOpenCreate: () => void;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  detailError: boolean;
  activeDoc: DocumentListItem | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export default function DocumentContentArea({
  searchQuery,
  onSearchChange,
  filteredDocuments,
  onOpenCreate,
  meta,
  onPageChange,
  onPageSizeChange,
  detailError,
  activeDoc,
  t,
  ...gridProps
}: DocumentContentAreaProps) {
  const { canWrite, detailMap } = gridProps;
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
          <DocumentCardGrid documents={filteredDocuments} {...gridProps} />
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
          <DragPreviewCard icon={<ArticleIcon fontSize="small" sx={{ color: 'var(--primary)' }} />} maxWidth={240}>
            {getDocumentDisplayName(activeDoc, detailMap)}
          </DragPreviewCard>
        ) : null}
      </DragOverlay>
    </>
  );
}
