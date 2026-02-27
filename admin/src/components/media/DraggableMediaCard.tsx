import { type ReactNode, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import type { MediaListItem } from '@/types/api';

interface DraggableMediaCardProps {
  file: MediaListItem;
  children: ReactNode;
}

export default function DraggableMediaCard({ file, children }: DraggableMediaCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: file.id,
    data: { type: 'media', item: file },
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };

  return (
    <Box ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </Box>
  );
}
