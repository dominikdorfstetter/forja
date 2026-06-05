import { useState } from 'react';
import { Box, Divider, IconButton, TextField, Tooltip } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
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
import FullscreenIcon from '@mui/icons-material/Fullscreen';

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleZen?: () => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

function ToolbarButton({ icon, title, action, isActive = false, disabled = false, 'data-testid': testId }: ToolbarButtonProps) {
  return (
    <Tooltip title={title} arrow>
      <span>
        <IconButton
          size="small"
          onClick={action}
          disabled={disabled}
          aria-pressed={isActive}
          data-testid={testId}
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

export default function EditorToolbar({ editor, onToggleZen }: EditorToolbarProps) {
  const { t } = useTranslation();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const openLinkDialog = () => {
    const previousUrl = editor.getAttributes('link').href ?? '';
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  };

  const handleLinkInsert = () => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
  };

  const handleLinkRemove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkDialogOpen(false);
    setLinkUrl('');
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setLinkUrl('');
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <>
      <Box
        role="toolbar"
        aria-label={t('editor.toolbar.label')}
        data-testid="editor-toolbar"
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
          data-testid="editor-toolbar.btn.bold"
        />
        <ToolbarButton
          icon={<FormatItalicIcon fontSize="small" />}
          title={t('editor.toolbar.italic')}
          action={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          data-testid="editor-toolbar.btn.italic"
        />
        <ToolbarButton
          icon={<FormatUnderlinedIcon fontSize="small" />}
          title={t('editor.toolbar.underline')}
          action={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          data-testid="editor-toolbar.btn.underline"
        />
        <ToolbarButton
          icon={<FormatStrikethroughIcon fontSize="small" />}
          title={t('editor.toolbar.strikethrough')}
          action={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          data-testid="editor-toolbar.btn.strikethrough"
        />

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          icon={<TitleIcon fontSize="small" />}
          title={t('editor.toolbar.heading1')}
          action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          data-testid="editor-toolbar.btn.h1"
        />
        <ToolbarButton
          icon={<TitleIcon sx={{ fontSize: 18 }} />}
          title={t('editor.toolbar.heading2')}
          action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          data-testid="editor-toolbar.btn.h2"
        />
        <ToolbarButton
          icon={<TitleIcon sx={{ fontSize: 14 }} />}
          title={t('editor.toolbar.heading3')}
          action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          data-testid="editor-toolbar.btn.h3"
        />

        <ToolbarDivider />

        {/* Structure */}
        <ToolbarButton
          icon={<FormatQuoteIcon fontSize="small" />}
          title={t('editor.toolbar.blockquote')}
          action={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          data-testid="editor-toolbar.btn.blockquote"
        />
        <ToolbarButton
          icon={<FormatListBulletedIcon fontSize="small" />}
          title={t('editor.toolbar.bulletList')}
          action={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          data-testid="editor-toolbar.btn.bullet-list"
        />
        <ToolbarButton
          icon={<FormatListNumberedIcon fontSize="small" />}
          title={t('editor.toolbar.orderedList')}
          action={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          data-testid="editor-toolbar.btn.ordered-list"
        />
        <ToolbarButton
          icon={<ChecklistIcon fontSize="small" />}
          title={t('editor.toolbar.taskList')}
          action={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          data-testid="editor-toolbar.btn.task-list"
        />
        <ToolbarButton
          icon={<HorizontalRuleIcon fontSize="small" />}
          title={t('editor.toolbar.horizontalRule')}
          action={() => editor.chain().focus().setHorizontalRule().run()}
          data-testid="editor-toolbar.btn.horizontal-rule"
        />

        <ToolbarDivider />

        {/* Insert */}
        <ToolbarButton
          icon={<LinkIcon fontSize="small" />}
          title={t('editor.toolbar.link')}
          action={openLinkDialog}
          isActive={editor.isActive('link')}
          data-testid="editor-toolbar.btn.link"
        />
        <ToolbarButton
          icon={<ImageIcon fontSize="small" />}
          title={t('editor.toolbar.image')}
          action={() => editor.commands.insertImageViaPicker()}
          data-testid="editor-toolbar.btn.image"
        />
        <ToolbarButton
          icon={<CodeIcon fontSize="small" />}
          title={t('editor.toolbar.codeBlock')}
          action={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          data-testid="editor-toolbar.btn.code-block"
        />
        <ToolbarButton
          icon={<TableChartIcon fontSize="small" />}
          title={t('editor.toolbar.insertTable')}
          action={insertTable}
          data-testid="editor-toolbar.btn.table"
        />

        <Box sx={{ flexGrow: 1 }} />

        {/* Zen mode */}
        {onToggleZen && (
          <ToolbarButton
            icon={<FullscreenIcon fontSize="small" />}
            title={t('editor.zen.tooltip')}
            action={onToggleZen}
            data-testid="editor-toolbar.btn.zen"
          />
        )}

        <ToolbarDivider />

        {/* History */}
        <ToolbarButton
          icon={<UndoIcon fontSize="small" />}
          title={t('editor.toolbar.undo')}
          action={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          data-testid="editor-toolbar.btn.undo"
        />
        <ToolbarButton
          icon={<RedoIcon fontSize="small" />}
          title={t('editor.toolbar.redo')}
          action={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          data-testid="editor-toolbar.btn.redo"
        />
      </Box>

      <FormDialog
        open={linkDialogOpen}
        onClose={handleLinkDialogClose}
        onSubmit={handleLinkInsert}
        icon="link"
        title={t('editor.toolbar.linkDialog.title')}
        submitLabel={t('editor.toolbar.linkDialog.insert')}
        maxWidth="xs"
        actions={
          <>
            {editor.isActive('link') && (
              <M3Button variant="outlined" size="sm" danger onClick={handleLinkRemove}>
                {t('editor.toolbar.linkDialog.remove')}
              </M3Button>
            )}
            <M3Button variant="ghost" size="sm" onClick={handleLinkDialogClose}>
              {t('common.actions.cancel')}
            </M3Button>
            <M3Button type="submit" variant="filled" size="sm">
              {t('editor.toolbar.linkDialog.insert')}
            </M3Button>
          </>
        }
      >
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={t('editor.toolbar.linkDialog.urlLabel')}
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://"
        />
      </FormDialog>
    </>
  );
}
