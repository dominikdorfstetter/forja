import { Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DocumentListItem, DocumentResponse } from '@/types/api';
import DraggableDocumentCard from '@/components/documents/DraggableDocumentCard';
import DocumentPrivacyBadge from '@/components/documents/DocumentPrivacyBadge';
import DocumentTypeTile from '@/components/documents/DocumentTypeTile';
import { getDocumentDisplayName } from '@/components/documents/documentDisplayName';
import { classifyPrivacyState } from '@/components/documents/privacyState';
import { M3IconButton } from '@/components/design-system';
import { LibraryCard } from '@/components/shared/library';
import { formatBytes } from '@/utils/formatBytes';

function getShareableUrl(doc: DocumentListItem): string | null {
  if (doc.url) return doc.url;
  if (doc.has_file) return `${window.location.origin}/api/v1/documents/${doc.id}/download`;
  return null;
}

/**
 * Renders the URL on a document card compactly — drops the protocol and,
 * for long paths, keeps the host + last segment so the card doesn't get
 * overrun by a wrapped path.
 */
function formatUrlPreview(raw: string): string {
  try {
    const u = new URL(raw);
    const stripped = `${u.host}${u.pathname}${u.search}`;
    if (stripped.length <= 44) return stripped;
    const parts = u.pathname.split('/').filter(Boolean);
    const tail = parts.length > 1 ? `/…/${parts[parts.length - 1]}` : u.pathname;
    return `${u.host}${tail}`;
  } catch {
    return raw;
  }
}

/** File size for uploads, compact URL for links, nothing otherwise. */
function documentCardSubtitle(doc: DocumentListItem): string {
  if (doc.has_file && doc.file_size != null) return formatBytes(doc.file_size);
  return doc.url ? formatUrlPreview(doc.url) : '';
}

/** Per-card permissions and action callbacks, shared with `DocumentContentArea`. */
export interface DocumentCardHandlers {
  canWrite: boolean;
  isAdmin: boolean;
  onDownload: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  onPrivacy?: (doc: DocumentListItem) => void;
  onUnlock?: (doc: DocumentListItem) => void;
}

export interface DocumentCardGridProps extends DocumentCardHandlers {
  documents: DocumentListItem[];
  detailMap: Map<string, DocumentResponse>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * M3 Expressive document grid. The type chip, the "Uploaded" chip, and
 * the redundant URL-on-its-own-line have been dropped — type is conveyed
 * by the coloured icon tile, and the URL is shown in a compact host +
 * tail form. Actions fade in as a tonal strip at the bottom on hover /
 * focus-within, matching the media grid's language.
 */
export default function DocumentCardGrid({
  documents,
  detailMap,
  selectedIds,
  onToggleSelect,
  ...handlers
}: DocumentCardGridProps) {
  const showActions = handlers.canWrite || handlers.isAdmin;

  return (
    <Grid container spacing={2}>
      {documents.map((doc) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={doc.id}>
          <DraggableDocumentCard document={doc}>
            <LibraryCard
              testId="document-card"
              selected={selectedIds?.has(doc.id) ?? false}
              onToggleSelect={onToggleSelect && (() => onToggleSelect(doc.id))}
              previewLayout="tile"
              preview={<DocumentTypeTile doc={doc} />}
              badge={doc.is_private ? <DocumentPrivacyBadge doc={doc} variant="card" /> : undefined}
              actions={showActions ? <DocumentCardActions doc={doc} {...handlers} /> : undefined}
              title={getDocumentDisplayName(doc, detailMap)}
              subtitle={documentCardSubtitle(doc)}
            />
          </DraggableDocumentCard>
        </Grid>
      ))}
    </Grid>
  );
}

function DocumentCardActions({
  doc,
  canWrite,
  onDownload,
  onEdit,
  onDelete,
  onPrivacy,
  onUnlock,
}: DocumentCardHandlers & { doc: DocumentListItem }) {
  const { t } = useTranslation();
  const shareableUrl = getShareableUrl(doc);
  const canUnlock = canWrite && onUnlock && classifyPrivacyState(doc) === 'locked';

  return (
    <>
      {doc.has_file && (
        <M3IconButton name="download" size={34} tooltip={t('common.actions.view')} onClick={() => onDownload(doc)} />
      )}
      {shareableUrl && (
        <M3IconButton
          name="content_copy"
          size={34}
          tooltip={t('documents.copyUrl')}
          onClick={() => navigator.clipboard.writeText(shareableUrl)}
        />
      )}
      {canWrite && doc.has_file && onPrivacy && (
        <M3IconButton
          name="lock"
          size={34}
          tooltip={t('documents.privacy.action')}
          data-testid="document-card.btn.privacy"
          onClick={() => onPrivacy(doc)}
        />
      )}
      {canUnlock && (
        <M3IconButton
          name="lock_open"
          size={34}
          tooltip={t('documents.privacy.unlock')}
          data-testid="document-card.btn.unlock"
          onClick={() => onUnlock(doc)}
        />
      )}
      <M3IconButton name="edit" size={34} tooltip={t('common.actions.edit')} onClick={() => onEdit(doc)} />
      <M3IconButton
        name="delete"
        size={34}
        tooltip={t('common.actions.delete')}
        ariaLabel={t('common.actions.delete')}
        onClick={() => onDelete(doc)}
      />
    </>
  );
}
