import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableCell } from '@mui/material';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { SocialLink } from '@/types/api';
import SortableSocialRow from '@/components/social/SortableSocialRow';
import { SortableTableShell } from '@/components/shared/listPageV2';

interface SocialLinksTableProps {
  links: SocialLink[];
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (link: SocialLink) => void;
  onDelete: (link: SocialLink) => void;
  /** Fired when a row is dropped onto a different row. */
  onReorder: (activeId: string, overId: string) => void;
}

/** Drag-to-reorder table of a site's social links. */
export default function SocialLinksTable({ links, canWrite, isAdmin, onEdit, onDelete, onReorder }: SocialLinksTableProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(active.id as string, over.id as string);
  };

  const activeLink = activeId ? links.find((l) => l.id === activeId) : undefined;

  return (
    <SortableTableShell
      itemIds={links.map((l) => l.id)}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      canWrite={canWrite}
      dragPreview={activeLink?.title}
      headCells={
        <>
          <TableCell scope="col">{t('socialLinks.table.title')}</TableCell>
          <TableCell scope="col">{t('socialLinks.table.url')}</TableCell>
          <TableCell scope="col">{t('socialLinks.table.icon')}</TableCell>
          <TableCell scope="col" align="right">{t('socialLinks.table.actions')}</TableCell>
        </>
      }
    >
      {links.map((link) => (
        <SortableSocialRow key={link.id} link={link} canWrite={canWrite} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </SortableTableShell>
  );
}
