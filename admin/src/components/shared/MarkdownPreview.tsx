import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <Box
      sx={{
        '& h1': { fontSize: '2rem', fontWeight: 700, mt: 3, mb: 1 },
        '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 2.5, mb: 1 },
        '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 0.5 },
        '& h4': { fontSize: '1.1rem', fontWeight: 600, mt: 1.5, mb: 0.5 },
        '& p': { my: 1, lineHeight: 1.7 },
        '& ul, & ol': { pl: 3, my: 1 },
        '& li': { mb: 0.5 },
        '& blockquote': {
          borderLeft: 4,
          borderColor: 'divider',
          pl: 2,
          ml: 0,
          color: 'text.secondary',
          fontStyle: 'italic',
        },
        '& a': { color: 'primary.main' },
        '& img': { maxWidth: '100%', borderRadius: 1 },
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          my: 2,
          '& th, & td': {
            border: 1,
            borderColor: 'divider',
            px: 1.5,
            py: 0.75,
            textAlign: 'left',
          },
          '& th': { fontWeight: 600, bgcolor: 'action.hover' },
        },
        '& hr': { my: 3, borderColor: 'divider' },
        '& pre': {
          overflow: 'auto',
          borderRadius: 1,
          p: 2,
          my: 2,
          bgcolor: 'grey.50',
          border: 1,
          borderColor: 'divider',
          '& code': { fontFamily: 'monospace', fontSize: '0.875rem' },
        },
        '& :not(pre) > code': {
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          bgcolor: 'grey.100',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
