import type { ReactElement } from 'react';
import { Grid, Box, Checkbox } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import LinkIcon from '@mui/icons-material/Link';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import type { DocumentListItem, DocumentResponse } from '@/types/api';
import DraggableDocumentCard from '@/components/documents/DraggableDocumentCard';
import DocumentPrivacyBadge from '@/components/documents/DocumentPrivacyBadge';
import { classifyPrivacyState } from '@/components/documents/privacyState';
import { M3IconButton } from '@/components/design-system';

interface TypePaint {
  icon: (size: number) => ReactElement;
  tileBg: string;
  tileFg: string;
}

function getTypePaint(documentType: string, hasFile: boolean): TypePaint {
  if (hasFile) {
    return {
      icon: (size) => <UploadFileIcon sx={{ fontSize: size }} />,
      tileBg: 'color-mix(in oklch, var(--info) 16%, transparent)',
      tileFg: 'var(--info)',
    };
  }
  switch (documentType) {
    case 'pdf':
      return {
        icon: (size) => <PictureAsPdfIcon sx={{ fontSize: size }} />,
        tileBg: 'color-mix(in oklch, var(--err) 16%, transparent)',
        tileFg: 'var(--err)',
      };
    case 'doc':
      return {
        icon: (size) => <DescriptionIcon sx={{ fontSize: size }} />,
        tileBg: 'var(--primary-container)',
        tileFg: 'var(--on-primary-container)',
      };
    case 'xlsx':
      return {
        icon: (size) => <TableChartIcon sx={{ fontSize: size }} />,
        tileBg: 'color-mix(in oklch, var(--tertiary-container) 70%, transparent)',
        tileFg: 'var(--on-tertiary-container)',
      };
    case 'zip':
      return {
        icon: (size) => <FolderZipIcon sx={{ fontSize: size }} />,
        tileBg: 'var(--warn-container)',
        tileFg: 'var(--on-warn-container)',
      };
    case 'link':
      return {
        icon: (size) => <LinkIcon sx={{ fontSize: size }} />,
        tileBg: 'color-mix(in oklch, var(--info) 16%, transparent)',
        tileFg: 'var(--info)',
      };
    default:
      return {
        icon: (size) => <InsertDriveFileIcon sx={{ fontSize: size }} />,
        tileBg: 'var(--surface-container-high)',
        tileFg: 'var(--on-surface-variant)',
      };
  }
}

function getShareableUrl(doc: DocumentListItem): string | null {
  if (doc.url) return doc.url;
  if (doc.has_file) return `${window.location.origin}/api/v1/documents/${doc.id}/download`;
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function getDocumentDisplayName(doc: DocumentListItem, detailMap: Map<string, DocumentResponse>): string {
  const detail = detailMap.get(doc.id);
  // Guard against a detail that arrives without a localizations array: the
  // contract declares it non-null, but a non-conforming API response (older
  // backend, legacy row) must degrade to the fallback name — not throw during
  // render and blank the whole page (#138).
  if (detail && detail.localizations && detail.localizations.length > 0) {
    return detail.localizations[0].name;
  }
  if (doc.has_file && doc.file_name) {
    return doc.file_name;
  }
  if (doc.url) {
    try {
      const url = new URL(doc.url);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      if (filename && filename.length > 0) return filename;
    } catch {
      // Not a valid URL, use as-is
    }
    return doc.url;
  }
  return 'Untitled';
}

interface DocumentCardGridProps {
  documents: DocumentListItem[];
  detailMap: Map<string, DocumentResponse>;
  canWrite: boolean;
  isAdmin: boolean;
  onDownload: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  onPrivacy?: (doc: DocumentListItem) => void;
  onUnlock?: (doc: DocumentListItem) => void;
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
  canWrite,
  isAdmin,
  onDownload,
  onEdit,
  onDelete,
  onPrivacy,
  onUnlock,
  selectedIds,
  onToggleSelect,
}: DocumentCardGridProps) {
  const { t } = useTranslation();

  return (
    <Grid container spacing={2}>
      {documents.map((doc) => {
        const isSelected = selectedIds?.has(doc.id) ?? false;
        const showCheckbox = !!onToggleSelect;
        const displayName = getDocumentDisplayName(doc, detailMap);
        const paint = getTypePaint(doc.document_type, doc.has_file);
        const shareableUrl = getShareableUrl(doc);
        const subtitle = doc.has_file && doc.file_size != null
          ? formatFileSize(doc.file_size)
          : doc.url
            ? formatUrlPreview(doc.url)
            : '';

        return (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={doc.id}>
            <DraggableDocumentCard document={doc}>
              <Box
                data-testid="document-card"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--surface-container)',
                  borderRadius: '20px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  position: 'relative',
                  outline: isSelected ? '2px solid var(--primary)' : 'none',
                  outlineOffset: isSelected ? -1 : 0,
                  transition:
                    'border-color 200ms cubic-bezier(0.2, 0, 0, 1), transform 200ms cubic-bezier(0.2, 0, 0, 1)',
                  '&:hover': {
                    borderColor: 'var(--outline)',
                    transform: 'translateY(-2px)',
                  },
                  '&:hover .doc-actions, &:focus-within .doc-actions': { opacity: 1, pointerEvents: 'auto' },
                  '&:hover .doc-checkbox, &:focus-within .doc-checkbox': { opacity: 1 },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    py: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'var(--surface-container-low)',
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 88,
                      height: 88,
                      borderRadius: '22px',
                      bgcolor: paint.tileBg,
                      color: paint.tileFg,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {paint.icon(44)}
                  </Box>

                  {doc.is_private && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                      }}
                    >
                      <DocumentPrivacyBadge doc={doc} variant="card" />
                    </Box>
                  )}

                  {showCheckbox && (
                    <Checkbox
                      className="doc-checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect?.(doc.id)}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        opacity: isSelected ? 1 : 0,
                        transition: 'opacity 160ms cubic-bezier(0.2, 0, 0, 1)',
                        bgcolor: 'rgba(255,255,255,0.9)',
                        borderRadius: '8px',
                        p: 0.25,
                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                      }}
                    />
                  )}

                  {(canWrite || isAdmin) && (
                    <Box
                      className="doc-actions"
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        bottom: 10,
                        display: 'flex',
                        gap: 0.5,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        p: 0.5,
                        bgcolor: 'color-mix(in oklch, var(--surface-container) 85%, transparent)',
                        color: 'var(--on-surface)',
                        borderRadius: '14px',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--outline-variant)',
                        opacity: 0,
                        pointerEvents: 'none',
                        transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
                      }}
                    >
                      {doc.has_file && (
                        <M3IconButton
                          name="download"
                          size={34}
                          tooltip={t('common.actions.view')}
                          onClick={() => onDownload(doc)}
                        />
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
                      {canWrite &&
                        onUnlock &&
                        classifyPrivacyState(doc) === 'locked' && (
                          <M3IconButton
                            name="lock_open"
                            size={34}
                            tooltip={t('documents.privacy.unlock')}
                            data-testid="document-card.btn.unlock"
                            onClick={() => onUnlock(doc)}
                          />
                        )}
                      <M3IconButton
                        name="edit"
                        size={34}
                        tooltip={t('common.actions.edit')}
                        onClick={() => onEdit(doc)}
                      />
                      <M3IconButton
                        name="delete"
                        size={34}
                        tooltip={t('common.actions.delete')}
                        ariaLabel={t('common.actions.delete')}
                        onClick={() => onDelete(doc)}
                      />
                    </Box>
                  )}
                </Box>

                <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
                  <Box
                    component="span"
                    title={displayName}
                    sx={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--on-surface)',
                      fontVariationSettings: '"wght" 600, "opsz" 14',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {displayName}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.25,
                      fontSize: 12,
                      color: 'var(--on-surface-variant)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minHeight: 16,
                    }}
                  >
                    {subtitle}
                  </Box>
                </Box>
              </Box>
            </DraggableDocumentCard>
          </Grid>
        );
      })}
    </Grid>
  );
}
