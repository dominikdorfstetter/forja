import { type ReactNode, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import { useReadOnly } from '@/hooks/useReadOnly';
import type { DocumentListItem } from '@/types/api';

interface DraggableDocumentCardProps {
  document: DocumentListItem;
  children: ReactNode;
}

export default function DraggableDocumentCard({ document, children }: DraggableDocumentCardProps) {
  // Drag-to-folder is a write: viewers/guests must not be able to initiate a
  // drag (#6). Disable the dnd sensor and drop the drag listeners/attributes.
  const { readOnly } = useReadOnly();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: document.id,
    data: { type: 'document', item: document },
    disabled: readOnly,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    cursor: readOnly ? 'default' : 'grab',
  };

  return (
    <Box ref={setNodeRef} style={style} {...(readOnly ? {} : { ...listeners, ...attributes })}>
      {children}
    </Box>
  );
}
