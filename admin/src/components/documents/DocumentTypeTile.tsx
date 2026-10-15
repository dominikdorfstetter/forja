import type { ReactElement } from 'react';
import { Box } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import LinkIcon from '@mui/icons-material/Link';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { DocumentListItem } from '@/types/api';

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

/** Coloured rounded tile conveying a document's type (uploaded file, PDF, sheet, link, …). */
export default function DocumentTypeTile({ doc }: { doc: DocumentListItem }) {
  const paint = getTypePaint(doc.document_type, doc.has_file);
  return (
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
  );
}
