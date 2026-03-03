import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Paper, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Extension } from '@tiptap/core';
import './types';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance } from 'tippy.js';
import { useTranslation } from 'react-i18next';
import TitleIcon from '@mui/icons-material/Title';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CodeIcon from '@mui/icons-material/Code';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import NotesIcon from '@mui/icons-material/Notes';

interface CommandItem {
  key: string;
  icon: React.ReactNode;
  command: (props: { editor: SuggestionProps['editor']; range: SuggestionProps['range'] }) => void;
}

const commands: CommandItem[] = [
  {
    key: 'paragraph',
    icon: <NotesIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    key: 'heading1',
    icon: <TitleIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    key: 'heading2',
    icon: <TitleIcon sx={{ fontSize: 18 }} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    key: 'heading3',
    icon: <TitleIcon sx={{ fontSize: 14 }} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    key: 'bulletList',
    icon: <FormatListBulletedIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    key: 'orderedList',
    icon: <FormatListNumberedIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    key: 'taskList',
    icon: <ChecklistIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    key: 'blockquote',
    icon: <FormatQuoteIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    key: 'codeBlock',
    icon: <CodeIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    key: 'horizontalRule',
    icon: <HorizontalRuleIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    key: 'image',
    icon: <ImageIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.commands.insertImageViaPicker();
    },
  },
  {
    key: 'table',
    icon: <TableChartIcon fontSize="small" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <Paper elevation={4} sx={{ maxHeight: 300, overflow: 'auto', minWidth: 200 }}>
      <List dense ref={listRef}>
        {items.map((item, index) => (
          <ListItemButton
            key={item.key}
            selected={index === selectedIndex}
            onClick={() => selectItem(index)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={t(`editor.commands.${item.key}`)} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
});

CommandList.displayName = 'CommandList';

const suggestionConfig: Omit<SuggestionOptions<CommandItem>, 'editor'> = {
  char: '/',
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  items: ({ query }) => {
    return commands.filter((item) => item.key.toLowerCase().includes(query.toLowerCase()));
  },
  render: () => {
    let component: ReactRenderer<CommandListRef>;
    let popup: Instance[];

    return {
      onStart: (props) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate: (props) => {
        component?.updateProps(props);
        if (props.clientRect) {
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {};
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...suggestionConfig,
      }),
    ];
  },
});
