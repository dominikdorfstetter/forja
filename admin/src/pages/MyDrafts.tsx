import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';

interface DraftItem {
  id: string;
  name: string;
  type: 'blog' | 'page';
  updated_at: string;
  editPath: string;
}

export default function MyDraftsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ['blogs', selectedSiteId, 'drafts'],
    queryFn: () => apiService.getBlogs(selectedSiteId, { page: 1, per_page: 100 }),
    enabled: !!selectedSiteId,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages', selectedSiteId, 'drafts'],
    queryFn: () => apiService.getPages(selectedSiteId, { page: 1, per_page: 100 }),
    enabled: !!selectedSiteId,
  });

  const isLoading = blogsLoading || pagesLoading;

  const drafts = useMemo<DraftItem[]>(() => {
    const draftBlogs: DraftItem[] = (blogsData?.data ?? [])
      .filter((b) => b.status === 'Draft')
      .map((b) => ({
        id: b.id,
        name: b.slug || t('common.labels.untitled'),
        type: 'blog' as const,
        updated_at: b.updated_at,
        editPath: `/blogs/${b.id}`,
      }));

    const draftPages: DraftItem[] = (pagesData?.data ?? [])
      .filter((p) => p.status === 'Draft')
      .map((p) => ({
        id: p.id,
        name: p.route || t('common.labels.untitled'),
        type: 'page' as const,
        updated_at: p.created_at,
        editPath: `/pages/${p.id}`,
      }));

    return [...draftBlogs, ...draftPages].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [blogsData, pagesData, t]);

  return (
    <Box>
      <PageHeader
        title={t('myDrafts.title')}
        subtitle={t('myDrafts.subtitle')}
        breadcrumbs={[
          { label: t('layout.sidebar.dashboard'), path: '/dashboard' },
          { label: t('myDrafts.title') },
        ]}
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<EditNoteIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('myDrafts.empty.noSite')}
        />
      ) : isLoading ? (
        <LoadingState label={t('myDrafts.loading')} />
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={<EditNoteIcon sx={{ fontSize: 64 }} />}
          title={t('myDrafts.empty.title')}
          description={t('myDrafts.empty.description')}
        />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell scope="col">{t('myDrafts.table.name')}</TableCell>
                <TableCell scope="col">{t('myDrafts.table.type')}</TableCell>
                <TableCell scope="col">{t('myDrafts.table.lastModified')}</TableCell>
                <TableCell scope="col" align="right">{t('common.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {drafts.map((draft) => (
                <TableRow key={`${draft.type}-${draft.id}`}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {draft.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={draft.type === 'blog' ? t('layout.sidebar.blogs') : t('layout.sidebar.pages')}
                      size="small"
                      variant="outlined"
                      color={draft.type === 'blog' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>{format(new Date(draft.updated_at), 'PPp')}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.actions.edit')}>
                      <IconButton
                        size="small"
                        aria-label={t('common.actions.edit')}
                        onClick={() => navigate(draft.editPath)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
