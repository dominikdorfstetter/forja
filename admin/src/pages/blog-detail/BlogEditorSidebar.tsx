import { Box, Tab, Tabs } from '@mui/material';
import { pageTabsSx } from '@/components/shared/listPageV2';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import TuneIcon from '@mui/icons-material/Tune';
import ImageIcon from '@mui/icons-material/Image';
import CategoryIcon from '@mui/icons-material/Category';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BlogContentFormData } from './blogDetailSchema';
import type { Category, Tag, BlogDocumentResponse } from '@/types/api';
import BlogSeoTab from './BlogSeoTab';
import BlogSettingsTab from './BlogSettingsTab';
import BlogMediaSection from './BlogMediaSection';
import BlogCategoryCard from '@/components/blogs/BlogCategoryCard';
import BlogTagCard from '@/components/blogs/BlogTagCard';
import BlogDocumentCard from '@/components/blogs/BlogDocumentCard';
import { useSiteContextData } from '@/hooks/useSiteContextData';

interface BlogEditorSidebarProps {
  activeTab: number;
  onTabChange: (tab: number) => void;
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  blogId: string;
  slug: string;
  canWrite: boolean;
  siteId: string;
  contentId: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  tags: Tag[];
  body: string;
  documents: BlogDocumentResponse[];
}

export default function BlogEditorSidebar({
  activeTab,
  onTabChange,
  control,
  watch,
  setValue,
  onSnapshot,
  blogId,
  slug,
  canWrite,
  siteId,
  contentId,
  publishedAt,
  createdAt,
  updatedAt,
  categories,
  tags,
  body,
  documents,
}: BlogEditorSidebarProps) {
  const { t } = useTranslation();
  const { modules } = useSiteContextData();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ ...pageTabsSx, mb: 0, flexShrink: 0 }}
      >
        <Tab icon={<TravelExploreIcon fontSize="small" />} iconPosition="start" label={t('blogDetail.sidebar.seo')} />
        <Tab icon={<TuneIcon fontSize="small" />} iconPosition="start" label={t('blogDetail.sidebar.general')} />
        <Tab icon={<ImageIcon fontSize="small" />} iconPosition="start" label={t('blogDetail.sidebar.media')} />
        <Tab icon={<CategoryIcon fontSize="small" />} iconPosition="start" label={t('blogDetail.sidebar.relations')} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {activeTab === 0 && (
          <BlogSeoTab
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={onSnapshot}
            blogId={blogId}
            slug={slug}
            canWrite={canWrite}
          />
        )}
        {activeTab === 1 && (
          <BlogSettingsTab
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={onSnapshot}
            blogId={blogId}
            contentId={contentId}
            publishedAt={publishedAt}
            createdAt={createdAt}
            updatedAt={updatedAt}
          />
        )}
        {activeTab === 2 && (
          <BlogMediaSection
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={onSnapshot}
            siteId={siteId}
          />
        )}
        {activeTab === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <BlogCategoryCard
              contentId={contentId}
              categories={categories}
            />
            <BlogTagCard
              contentId={contentId}
              tags={tags}
              blogBody={body}
              aiAvailable={modules.ai}
            />
            {modules.documents && (
              <BlogDocumentCard
                blogId={blogId}
                documents={documents}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
