import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getBlogs } from '@/services/blogs';
import { getPages } from '@/services/pages';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { useSiteContext } from '@/store/SiteContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import {
  PageHeader,
  DataTableV2,
  type DataTableV2Column,
} from '@/components/shared/listPageV2';
import { DocIcon, M3IconButton } from '@/components/design-system';

interface DraftItem {
  id: string;
  name: string;
  type: 'blog' | 'page';
  updated_at: string;
  editPath: string;
}

export default function MyDraftsPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ['blogs', selectedSiteId, 'drafts'],
    queryFn: () => getBlogs(selectedSiteId, { page: 1, page_size: 100 }),
    enabled: !!selectedSiteId,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages', selectedSiteId, 'drafts'],
    queryFn: () => getPages(selectedSiteId, { page: 1, page_size: 100 }),
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

  const columns: DataTableV2Column<DraftItem>[] = [
    {
      key: 'name',
      label: t('myDrafts.table.name'),
      width: '1fr',
      render: (d) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <DocIcon type={d.type} size={18} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {d.name}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      label: t('myDrafts.table.type'),
      width: '120px',
      muted: true,
      render: (d) =>
        d.type === 'blog' ? t('layout.sidebar.blogs') : t('layout.sidebar.pages'),
    },
    {
      key: 'updated_at',
      label: t('myDrafts.table.lastModified'),
      width: '180px',
      muted: true,
      render: (d) => fmt(d.updated_at, 'PPp'),
    },
  ];

  return (
    <Box data-testid="my-drafts.page">
      <PageHeader
        icon="edit_note"
        breadcrumb={t('layout.sidebar.dashboard') + ' / ' + t('myDrafts.title')}
        title={t('myDrafts.title')}
        subtitle={t('myDrafts.subtitle')}
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
        <DataTableV2<DraftItem>
          data-testid="my-drafts.table"
          columns={columns}
          rows={drafts}
          getKey={(d) => `${d.type}-${d.id}`}
          onRowClick={(d) => navigate(d.editPath)}
          renderActions={(d) => (
            <M3IconButton
              name="edit"
              size={32}
              ariaLabel={t('common.actions.edit')}
              onClick={() => navigate(d.editPath)}
            />
          )}
        />
      )}
    </Box>
  );
}
