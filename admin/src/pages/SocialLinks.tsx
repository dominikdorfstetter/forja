import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { SocialLink, CreateSocialLinkRequest, UpdateSocialLinkRequest, ReorderItem } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SocialLinkFormDialog from '@/components/social/SocialLinkFormDialog';
import SortableSocialRow from '@/components/social/SortableSocialRow';

export default function SocialLinksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SocialLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<SocialLink | null>(null);
  const [orderedLinks, setOrderedLinks] = useState<SocialLink[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: links, isLoading, error } = useQuery({
    queryKey: ['social-links', selectedSiteId],
    queryFn: () => apiService.getSocialLinks(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  // Sync ordered list from query data
  useEffect(() => {
    if (links) setOrderedLinks(links);
  }, [links]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateSocialLinkRequest) => apiService.createSocialLink(selectedSiteId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['social-links'] }); setFormOpen(false); enqueueSnackbar(t('socialLinks.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSocialLinkRequest }) => apiService.updateSocialLink(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['social-links'] }); setEditingLink(null); enqueueSnackbar(t('socialLinks.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteSocialLink(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['social-links'] }); setDeletingLink(null); enqueueSnackbar(t('socialLinks.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => apiService.reorderSocialLinks(selectedSiteId, items),
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
      // Rollback: refetch from server
      queryClient.invalidateQueries({ queryKey: ['social-links'] });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedLinks((prev) => {
      const oldIndex = prev.findIndex((l) => l.id === active.id);
      const newIndex = prev.findIndex((l) => l.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      // Build reorder items with new display_order based on position
      const items: ReorderItem[] = reordered.map((link, index) => ({
        id: link.id,
        display_order: index,
      }));
      reorderMutation.mutate(items);

      return reordered;
    });
  }, [reorderMutation]);

  const activeLink = activeId ? orderedLinks.find((l) => l.id === activeId) : null;

  return (
    <Box>
      <PageHeader
        title={t('socialLinks.title')}
        subtitle={t('socialLinks.subtitle')}
        action={selectedSiteId ? { label: t('socialLinks.addLink'), icon: <AddIcon />, onClick: () => setFormOpen(true), hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('socialLinks.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('socialLinks.loading')} />
      ) : error ? (
        <Alert severity="error">{t('socialLinks.loadError')}</Alert>
      ) : !orderedLinks || orderedLinks.length === 0 ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('socialLinks.empty.title')} description={t('socialLinks.empty.description')} action={{ label: t('socialLinks.addLink'), onClick: () => setFormOpen(true) }} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                  <TableCell scope="col">{t('socialLinks.table.title')}</TableCell>
                  <TableCell scope="col">{t('socialLinks.table.url')}</TableCell>
                  <TableCell scope="col">{t('socialLinks.table.icon')}</TableCell>
                  <TableCell scope="col" align="right">{t('socialLinks.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={orderedLinks.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {orderedLinks.map((link) => (
                    <SortableSocialRow
                      key={link.id}
                      link={link}
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      onEdit={setEditingLink}
                      onDelete={setDeletingLink}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeLink ? (
              <Paper
                elevation={12}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  pointerEvents: 'none',
                }}
              >
                <DragIndicatorIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500} noWrap>{activeLink.title}</Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <SocialLinkFormDialog open={formOpen} siteId={selectedSiteId} onSubmit={(data) => createMutation.mutate(data)} onClose={() => setFormOpen(false)} loading={createMutation.isPending} />
      <SocialLinkFormDialog open={!!editingLink} siteId={selectedSiteId} link={editingLink} onSubmit={(data) => editingLink && updateMutation.mutate({ id: editingLink.id, data })} onClose={() => setEditingLink(null)} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingLink} title={t('socialLinks.deleteDialog.title')} message={t('socialLinks.deleteDialog.message', { title: deletingLink?.title })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingLink && deleteMutation.mutate(deletingLink.id)} onCancel={() => setDeletingLink(null)} loading={deleteMutation.isPending} />
    </Box>
  );
}
