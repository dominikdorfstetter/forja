import { Box, Tab, Tabs } from '@mui/material';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import TuneIcon from '@mui/icons-material/Tune';
import ImageIcon from '@mui/icons-material/Image';
import CategoryIcon from '@mui/icons-material/Category';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BlogContentFormData } from './blogDetailSchema';
import type { Category, BlogDocumentResponse } from '@/types/api';
import BlogSeoTab from './BlogSeoTab';
import BlogSettingsTab from './BlogSettingsTab';
import BlogMediaSection from './BlogMediaSection';
import BlogCategoryCard from '@/components/blogs/BlogCategoryCard';
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
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <Tab
          icon={<TravelExploreIcon fontSize="small" />}
          iconPosition="start"
          label={t('blogDetail.sidebar.seo')}
          sx={{ minHeight: 48, textTransform: 'none' }}
        />
        <Tab
          icon={<TuneIcon fontSize="small" />}
          iconPosition="start"
          label={t('blogDetail.sidebar.general')}
          sx={{ minHeight: 48, textTransform: 'none' }}
        />
        <Tab
          icon={<ImageIcon fontSize="small" />}
          iconPosition="start"
          label={t('blogDetail.sidebar.media')}
          sx={{ minHeight: 48, textTransform: 'none' }}
        />
        <Tab
          icon={<CategoryIcon fontSize="small" />}
          iconPosition="start"
          label={t('blogDetail.sidebar.relations')}
          sx={{ minHeight: 48, textTransform: 'none' }}
        />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {activeTab === 0 && (
          <BlogSeoTab
            control={control}
            watch={watch}
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
