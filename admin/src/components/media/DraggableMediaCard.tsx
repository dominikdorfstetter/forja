import { type ReactNode, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { useReadOnly } from '@/hooks/useReadOnly';
import type { MediaListItem } from '@/types/api';

interface DraggableMediaCardProps {
  file: MediaListItem;
  children: ReactNode;
}

export default function DraggableMediaCard({ file, children }: DraggableMediaCardProps) {
  // Reorder-to-folder is a write: viewers/guests must not be able to initiate a
  // drag (#6). Disable the dnd sensor and drop the drag listeners/attributes so
  // there's no drag affordance at all under read-only.
  const { readOnly } = useReadOnly();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: file.id,
    data: { type: 'media', item: file },
    disabled: readOnly,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    cursor: readOnly ? 'default' : 'grab',
    height: '100%',
    width: '100%',
  };

  return (
    <Box ref={setNodeRef} style={style} {...(readOnly ? {} : { ...listeners, ...attributes })}>
      {children}
    </Box>
  );
}
