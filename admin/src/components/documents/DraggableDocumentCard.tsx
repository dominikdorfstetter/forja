import { type ReactNode, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import type { DocumentListItem } from '@/types/api';

interface DraggableDocumentCardProps {
  document: DocumentListItem;
  children: ReactNode;
}

export default function DraggableDocumentCard({ document, children }: DraggableDocumentCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: document.id,
    data: { type: 'document', item: document },
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
