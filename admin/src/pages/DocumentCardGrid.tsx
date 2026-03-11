import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Box,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
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

function getDocTypeIcon(documentType: string) {
  switch (documentType) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ fontSize: 48 }} color="error" />;
    case 'doc':
      return <DescriptionIcon sx={{ fontSize: 48 }} color="primary" />;
    case 'xlsx':
      return <TableChartIcon sx={{ fontSize: 48 }} color="success" />;
    case 'zip':
      return <FolderZipIcon sx={{ fontSize: 48 }} color="warning" />;
    case 'link':
      return <LinkIcon sx={{ fontSize: 48 }} color="info" />;
    default:
      return <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />;
  }
}

function getDocTypeColor(documentType: string): 'error' | 'primary' | 'success' | 'warning' | 'info' | 'default' {
  switch (documentType) {
    case 'pdf':
      return 'error';
    case 'doc':
      return 'primary';
    case 'xlsx':
      return 'success';
    case 'zip':
      return 'warning';
    case 'link':
      return 'info';
    default:
      return 'default';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDocumentDisplayName(doc: DocumentListItem, detailMap: Map<string, DocumentResponse>): string {
  const detail = detailMap.get(doc.id);
  if (detail && detail.localizations.length > 0) {
    return detail.localizations[0].name;
  }
  // For uploaded files, prefer file_name
  if (doc.has_file && doc.file_name) {
    return doc.file_name;
  }
  // Fallback: use the URL filename or the URL itself
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
  return 'Untitled'; // Note: this is in a standalone function outside the component, not localized
}

interface DocumentCardGridProps {
  documents: DocumentListItem[];
  detailMap: Map<string, DocumentResponse>;
  canWrite: boolean;
  isAdmin: boolean;
  onDownload: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
}

export default function DocumentCardGrid({
  documents,
  detailMap,
  canWrite,
  isAdmin,
  onDownload,
  onEdit,
  onDelete,
}: DocumentCardGridProps) {
  const { t } = useTranslation();

  return (
    <Grid container spacing={2}>
      {documents.map((doc) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={doc.id}>
          <DraggableDocumentCard document={doc}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s, transform 0.2s',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                },
                '&:hover .doc-actions': { opacity: 1 },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  pt: 2,
                }}
              >
                {doc.has_file ? (
                  <UploadFileIcon sx={{ fontSize: 48 }} color="secondary" />
                ) : (
                  getDocTypeIcon(doc.document_type)
                )}
              </Box>
              <CardContent sx={{ pb: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap title={getDocumentDisplayName(doc, detailMap)}>
                  {getDocumentDisplayName(doc, detailMap)}
                </Typography>
                {doc.has_file ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    noWrap
                    sx={{ mt: 0.5 }}
                  >
                    {doc.file_name}
                    {doc.file_size != null && ` (${formatFileSize(doc.file_size)})`}
                  </Typography>
                ) : doc.url ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    noWrap
                    title={doc.url}
                    sx={{ mt: 0.5 }}
                  >
                    {doc.url}
                  </Typography>
                ) : null}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={doc.document_type.toUpperCase()}
                    size="small"
                    color={getDocTypeColor(doc.document_type)}
                    variant="outlined"
                  />
                  {doc.has_file && (
                    <Chip
                      label="Uploaded"
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>
              {(canWrite || isAdmin) && (
                <CardActions
                  className="doc-actions"
                  sx={{
                    justifyContent: 'flex-end',
                    pt: 0,
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {doc.has_file && (
                    <Tooltip title={t('common.actions.view')}>
                      <IconButton
                        size="small"
                        aria-label={t('common.actions.view')}
                        color="primary"
                        onClick={() => onDownload(doc)}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('common.actions.edit')}>
                    <IconButton
                      size="small"
                      aria-label={t('common.actions.edit')}
                      onClick={() => onEdit(doc)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.actions.delete')}>
                    <IconButton
                      size="small"
                      aria-label={t('common.actions.delete')}
                      color="error"
                      onClick={() => onDelete(doc)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              )}
            </Card>
          </DraggableDocumentCard>
        </Grid>
      ))}
    </Grid>
  );
}
