import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import './types';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ChecklistIcon from '@mui/icons-material/Checklist';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TitleIcon from '@mui/icons-material/Title';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

function ToolbarButton({ icon, title, action, isActive = false, disabled = false }: ToolbarButtonProps) {
  return (
    <Tooltip title={title} arrow>
      <span>
        <IconButton
          size="small"
          onClick={action}
          disabled={disabled}
          sx={{
            borderRadius: 1,
            bgcolor: isActive ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation();

  if (!editor) return null;

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.25,
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      {/* Text formatting */}
      <ToolbarButton
        icon={<FormatBoldIcon fontSize="small" />}
        title={t('editor.toolbar.bold')}
        action={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      />
      <ToolbarButton
        icon={<FormatItalicIcon fontSize="small" />}
        title={t('editor.toolbar.italic')}
        action={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      />
      <ToolbarButton
        icon={<FormatUnderlinedIcon fontSize="small" />}
        title={t('editor.toolbar.underline')}
        action={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
      />
      <ToolbarButton
        icon={<FormatStrikethroughIcon fontSize="small" />}
        title={t('editor.toolbar.strikethrough')}
        action={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      />

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        icon={<TitleIcon fontSize="small" />}
        title={t('editor.toolbar.heading1')}
        action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
      />
      <ToolbarButton
        icon={<TitleIcon sx={{ fontSize: 18 }} />}
        title={t('editor.toolbar.heading2')}
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      />
      <ToolbarButton
        icon={<TitleIcon sx={{ fontSize: 14 }} />}
        title={t('editor.toolbar.heading3')}
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
      />

      <ToolbarDivider />

      {/* Structure */}
      <ToolbarButton
        icon={<FormatQuoteIcon fontSize="small" />}
        title={t('editor.toolbar.blockquote')}
        action={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      />
      <ToolbarButton
        icon={<FormatListBulletedIcon fontSize="small" />}
        title={t('editor.toolbar.bulletList')}
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      />
      <ToolbarButton
        icon={<FormatListNumberedIcon fontSize="small" />}
        title={t('editor.toolbar.orderedList')}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
      />
      <ToolbarButton
        icon={<ChecklistIcon fontSize="small" />}
        title={t('editor.toolbar.taskList')}
        action={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
      />
      <ToolbarButton
        icon={<HorizontalRuleIcon fontSize="small" />}
        title={t('editor.toolbar.horizontalRule')}
        action={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <ToolbarDivider />

      {/* Insert */}
      <ToolbarButton
        icon={<LinkIcon fontSize="small" />}
        title={t('editor.toolbar.link')}
        action={insertLink}
        isActive={editor.isActive('link')}
      />
      <ToolbarButton
        icon={<ImageIcon fontSize="small" />}
        title={t('editor.toolbar.image')}
        action={() => editor.commands.insertImageViaPicker()}
      />
      <ToolbarButton
        icon={<CodeIcon fontSize="small" />}
        title={t('editor.toolbar.codeBlock')}
        action={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
      />
      <ToolbarButton
        icon={<TableChartIcon fontSize="small" />}
        title={t('editor.toolbar.insertTable')}
        action={insertTable}
      />

      <Box sx={{ flexGrow: 1 }} />

      {/* History */}
      <ToolbarButton
        icon={<UndoIcon fontSize="small" />}
        title={t('editor.toolbar.undo')}
        action={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      />
      <ToolbarButton
        icon={<RedoIcon fontSize="small" />}
        title={t('editor.toolbar.redo')}
        action={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      />
    </Box>
  );
}
