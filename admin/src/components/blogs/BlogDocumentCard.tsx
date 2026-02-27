import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Link,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { BlogDocumentResponse } from '@/types/api';
import DocumentPickerDialog from './DocumentPickerDialog';
import { useTranslation } from 'react-i18next';

interface BlogDocumentCardProps {
  blogId: string;
  documents: BlogDocumentResponse[];
}

export default function BlogDocumentCard({ blogId, documents }: BlogDocumentCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [pickerOpen, setPickerOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blog-detail'] });
  };

  const assignMutation = useMutation({
    mutationFn: (documentIds: string[]) =>
      Promise.all(
        documentIds.map((documentId, index) =>
          apiService.assignBlogDocument(blogId, {
            document_id: documentId,
            display_order: documents.length + index,
          }),
        ),
      ),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Document(s) attached successfully', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Failed to attach document(s)', { variant: 'error' });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiService.unassignBlogDocument(blogId, documentId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Document detached', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Failed to detach document', { variant: 'error' });
    },
  });

  const getDocumentName = (doc: BlogDocumentResponse): string => {
    if (doc.localizations && doc.localizations.length > 0) {
      return doc.localizations[0].name;
    }
    if (doc.has_file && doc.file_name) {
      return doc.file_name;
    }
    if (doc.url) {
      return doc.url.split('/').pop() || 'Untitled';
    }
    return 'Untitled';
  };

  const handleAttach = (documentIds: string[]) => {
    setPickerOpen(false);
    if (documentIds.length > 0) {
      assignMutation.mutate(documentIds);
    }
  };

  const handleDownload = async (doc: BlogDocumentResponse) => {
    try {
      const blob = await apiService.downloadDocument(doc.document_id);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'download';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    }
  };

  const excludeIds = documents.map((d) => d.document_id);

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {t('blogDetail.documents.title')}
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('blogDetail.documents.empty')}
            </Typography>
          ) : (
            <List dense disablePadding sx={{ mb: 1 }}>
              {documents.map((doc) => (
                <ListItem key={doc.id} disableGutters sx={{ pr: 5 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                          {getDocumentName(doc)}
                        </Typography>
                        <Chip
                          label={doc.document_type}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                        {doc.has_file && (
                          <Chip
                            label="File"
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 18 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      doc.has_file ? (
                        <Button
                          size="small"
                          startIcon={<DownloadIcon sx={{ fontSize: 12 }} />}
                          onClick={() => handleDownload(doc)}
                          sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none' }}
                        >
                          Download {doc.file_name}
                        </Button>
                      ) : doc.url ? (
                        <Link
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="caption"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.3,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <LinkIcon sx={{ fontSize: 12 }} />
                          {doc.url}
                        </Link>
                      ) : null
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => unassignMutation.mutate(doc.document_id)}
                      disabled={unassignMutation.isPending}
                      aria-label={`Detach ${getDocumentName(doc)}`}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          <Button
            size="small"
            startIcon={<AttachFileIcon />}
            onClick={() => setPickerOpen(true)}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? t('common.actions.saving') : t('blogDetail.documents.attach')}
          </Button>
        </CardContent>
      </Card>

      <DocumentPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAttach={handleAttach}
        excludeIds={excludeIds}
      />
    </>
  );
}
