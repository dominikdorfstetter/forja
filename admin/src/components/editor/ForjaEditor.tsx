import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import type { MarkdownStorage } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import ImagePickerExtension from './ImagePickerExtension';
import EditorToolbar from './EditorToolbar';
import ZenModeOverlay from './ZenModeOverlay';
import { SlashCommands } from './SlashCommandMenu';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { getMediaById } from '@/services/media';
const lowlight = createLowlight(common);

const editorContentSx = {
  '& .tiptap': {
    outline: 'none',
    minHeight: '100%',
    px: 2,
    py: 1.5,
    '& p.is-editor-empty:first-of-type::before': {
      content: 'attr(data-placeholder)',
      float: 'left',
      color: 'text.disabled',
      pointerEvents: 'none',
      height: 0,
    },
    '& h1': { fontSize: '2rem', fontWeight: 700, mt: 3, mb: 1 },
    '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 2.5, mb: 1 },
    '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 0.5 },
    '& blockquote': {
      borderLeft: 3,
      borderColor: 'divider',
      pl: 2,
      ml: 0,
      color: 'text.secondary',
    },
    '& pre': {
      bgcolor: 'grey.100',
      borderRadius: 1,
      p: 2,
      overflow: 'auto',
      '& code': { fontFamily: 'monospace', fontSize: '0.875rem' },
    },
    '& code': {
      bgcolor: 'grey.100',
      borderRadius: 0.5,
      px: 0.5,
      fontFamily: 'monospace',
      fontSize: '0.875rem',
    },
    '& img': {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: 1,
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      '& td, & th': {
        border: 1,
        borderColor: 'divider',
        p: 1,
        minWidth: 80,
      },
      '& th': { fontWeight: 600, bgcolor: 'grey.50' },
    },
    '& ul[data-type="taskList"]': {
      listStyle: 'none',
      pl: 0,
      '& li': {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        '& label': { mt: 0.25 },
      },
    },
    '& hr': { border: 'none', borderTop: 1, borderColor: 'divider', my: 2 },
  },
} as const;

interface ForjaEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  height?: number;
  placeholder?: string;
  siteId?: string;
  readOnly?: boolean;
}

export default function ForjaEditor({
  value,
  onChange,
  onBlur,
  height = 500,
  placeholder,
  siteId,
  readOnly = false,
}: ForjaEditorProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('editor.placeholder');
  const lastSerializedRef = useRef<string>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => !prev);
  }, []);

  const handleImageInsert = useCallback(() => {
    setMediaPickerOpen(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
      Link.configure({ openOnClick: false }),
      Underline,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImagePickerExtension.configure({ onImageInsert: handleImageInsert }),
      SlashCommands.configure({ onToggleZen: toggleZenMode }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = ((editor.storage as any).markdown as MarkdownStorage).getMarkdown();
      lastSerializedRef.current = md;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(md), 100);
    },
    onBlur: ({ editor }) => {
      // Flush any pending debounced onChange so the form value is up-to-date
      // before external onBlur (e.g. formHistory.snapshot()) reads it
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = ((editor.storage as any).markdown as MarkdownStorage).getMarkdown();
        lastSerializedRef.current = md;
        onChange(md);
      }
      onBlur?.();
    },
  });

  // Sync external value changes (e.g., form reset / undo) without resetting cursor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value !== lastSerializedRef.current) {
      // Cancel any pending debounced onChange to prevent it from overwriting
      // the restored value with stale content
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }
      lastSerializedRef.current = value;
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleMediaSelect = async (mediaId: string | null) => {
    if (mediaId && editor) {
      try {
        const media = await getMediaById(mediaId);
        if (media.public_url) {
          editor.chain().focus().setImage({ src: media.public_url }).run();
        }
      } catch {
        // Fall back silently — image won't be inserted
      }
    }
    setMediaPickerOpen(false);
  };

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }} data-testid="forja-editor">
        {!zenMode && <EditorToolbar editor={editor} onToggleZen={toggleZenMode} />}
        {!zenMode && (
          <Box sx={{ height, overflow: 'auto', ...editorContentSx }}>
            <EditorContent editor={editor} />
          </Box>
        )}
      </Paper>

      {zenMode &&
        createPortal(
          <ZenModeOverlay onExit={toggleZenMode}>
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 2,
              }}
            >
              <EditorToolbar editor={editor} onToggleZen={toggleZenMode} />
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', ...editorContentSx }}>
              <EditorContent editor={editor} />
            </Box>
          </ZenModeOverlay>,
          document.body,
        )}

      {siteId && (
        <MediaPickerDialog
          open={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          siteId={siteId}
          onSelect={handleMediaSelect}
        />
      )}
    </>
  );
}
