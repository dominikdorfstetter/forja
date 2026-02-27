import { useState, useCallback, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';

export interface FolderNode {
  id: string;
  parent_id?: string;
  name: string;
  display_order: number;
}

interface FolderTreeProps {
  folders: FolderNode[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  canWrite: boolean;
  droppable?: boolean;
}

interface InlineEditorState {
  mode: 'create' | 'rename';
  parentId?: string;
  folderId?: string;
  value: string;
}

function DroppableFolderEntry({
  id,
  folderId,
  enabled,
  children,
}: {
  id: string;
  folderId: string | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { folderId },
    disabled: !enabled,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={
        isOver && enabled
          ? {
              bgcolor: 'action.hover',
              outline: '2px solid',
              outlineColor: 'primary.main',
              borderRadius: 1,
            }
          : undefined
      }
    >
      {children}
    </Box>
  );
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  canWrite,
  droppable,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<InlineEditorState | null>(null);

  // Build tree structure: map parent_id -> children
  const childrenMap = useMemo(() => {
    const map = new Map<string | undefined, FolderNode[]>();
    for (const folder of folders) {
      const key = folder.parent_id ?? '__root__';
      const list = map.get(key) ?? [];
      list.push(folder);
      map.set(key, list);
    }
    // Sort each group by display_order
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order);
    }
    return map;
  }, [folders]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const startCreate = useCallback((parentId?: string) => {
    setEditor({ mode: 'create', parentId, value: '' });
    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
  }, []);

  const startRename = useCallback((folder: FolderNode) => {
    setEditor({ mode: 'rename', folderId: folder.id, value: folder.name });
  }, []);

  const cancelEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const confirmEditor = useCallback(() => {
    if (!editor || !editor.value.trim()) return;
    if (editor.mode === 'create') {
      onCreateFolder(editor.value.trim(), editor.parentId);
    } else if (editor.mode === 'rename' && editor.folderId) {
      onRenameFolder(editor.folderId, editor.value.trim());
    }
    setEditor(null);
  }, [editor, onCreateFolder, onRenameFolder]);

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEditor();
      } else if (e.key === 'Escape') {
        cancelEditor();
      }
    },
    [confirmEditor, cancelEditor],
  );

  const renderInlineEditor = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, gap: 0.5 }}>
      <TextField
        autoFocus
        size="small"
        variant="standard"
        placeholder={t('shared.folderTree.folderName')}
        value={editor?.value ?? ''}
        onChange={(e) => setEditor((prev) => (prev ? { ...prev, value: e.target.value } : null))}
        onKeyDown={handleEditorKeyDown}
        sx={{ flex: 1 }}
        inputProps={{ 'aria-label': t('shared.folderTree.folderName') }}
      />
      <IconButton size="small" onClick={confirmEditor} color="primary" aria-label={t('common.actions.confirm')}>
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={cancelEditor} aria-label={t('common.actions.cancel')}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const renderFolder = (folder: FolderNode, depth: number) => {
    const children = childrenMap.get(folder.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isRenaming = editor?.mode === 'rename' && editor.folderId === folder.id;
    const isCreatingChild = editor?.mode === 'create' && editor.parentId === folder.id;

    if (isRenaming) {
      return (
        <Box key={folder.id} sx={{ pl: depth * 2 }}>
          {renderInlineEditor()}
        </Box>
      );
    }

    const folderButton = (
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelectFolder(folder.id)}
        sx={{ pl: 2 + depth * 2, pr: 1 }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(folder.id);
            }}
            sx={{ mr: 0.5 }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 34, mr: 0.5 }} />
        )}
        <ListItemIcon sx={{ minWidth: 32 }}>
          {isExpanded && hasChildren ? (
            <FolderOpenIcon fontSize="small" color="primary" />
          ) : (
            <FolderIcon fontSize="small" color="primary" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap>
              {folder.name}
            </Typography>
          }
        />
        {canWrite && (
          <Box sx={{ display: 'flex', opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 }, transition: 'opacity 0.15s' }}>
            <Tooltip title={t('shared.folderTree.newFolder')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  startCreate(folder.id);
                }}
                aria-label={t('shared.folderTree.newFolder')}
              >
                <CreateNewFolderIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('shared.folderTree.rename')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(folder);
                }}
                aria-label={t('shared.folderTree.rename')}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('shared.folderTree.delete')}>
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
                aria-label={t('shared.folderTree.delete')}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </ListItemButton>
    );

    return (
      <Box key={folder.id}>
        {droppable ? (
          <DroppableFolderEntry id={`folder-${folder.id}`} folderId={folder.id} enabled>
            {folderButton}
          </DroppableFolderEntry>
        ) : (
          folderButton
        )}

        {(hasChildren || isCreatingChild) && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit={false}>
            <List component="div" disablePadding>
              {children.map((child) => renderFolder(child, depth + 1))}
              {isCreatingChild && (
                <Box sx={{ pl: (depth + 1) * 2 }}>{renderInlineEditor()}</Box>
              )}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const rootFolders = childrenMap.get('__root__') ?? [];
  const isCreatingRoot = editor?.mode === 'create' && !editor.parentId;

  const allItemsButton = (
    <ListItemButton
      selected={selectedFolderId === null}
      onClick={() => onSelectFolder(null)}
      sx={{ pl: 2, pr: 1 }}
    >
      <Box sx={{ width: 34, mr: 0.5 }} />
      <ListItemIcon sx={{ minWidth: 32 }}>
        <AllInboxIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={selectedFolderId === null ? 600 : 400}>
            {t('shared.folderTree.allFiles')}
          </Typography>
        }
      />
    </ListItemButton>
  );

  return (
    <Box sx={{ width: '100%' }}>
      <List component="nav" dense disablePadding>
        {/* Root "All Items" entry — drop here removes folder assignment */}
        {droppable ? (
          <DroppableFolderEntry id="folder-__root__" folderId={null} enabled>
            {allItemsButton}
          </DroppableFolderEntry>
        ) : (
          allItemsButton
        )}

        {/* Folder tree */}
        {rootFolders.map((folder) => renderFolder(folder, 0))}

        {/* Inline editor for new root folder */}
        {isCreatingRoot && renderInlineEditor()}
      </List>

      {/* New Folder button */}
      {canWrite && !editor && (
        <Box sx={{ px: 1, pt: 1 }}>
          <Button
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => startCreate()}
            fullWidth
            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
          >
            {t('shared.folderTree.newFolder')}
          </Button>
        </Box>
      )}
    </Box>
  );
}
