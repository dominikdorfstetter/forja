import {
  Box,
  Drawer,
  Grid,
  Paper,
  TextField,
} from '@mui/material';
import { Controller, type Control, type UseFormGetValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import type { Category, BlogDocumentResponse } from '@/types/api';
import type { BlogContentFormData } from './blogDetailSchema';
import { parseToc } from './blogDetailSchema';
import BlogEditorSidebar from './BlogEditorSidebar';
import BlogTocPanel from './BlogTocPanel';

const SIDEBAR_WIDTH = 380;

interface BlogEditorContentProps {
  control: Control<BlogContentFormData>;
  getValues: UseFormGetValues<BlogContentFormData>;
  watch: ReturnType<typeof import('react-hook-form').useForm<BlogContentFormData>>['watch'];
  setValue: ReturnType<typeof import('react-hook-form').useForm<BlogContentFormData>>['setValue'];
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
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  sidebarTab: number;
  onSidebarTabChange: (tab: number) => void;
  isMobile: boolean;
}

export default function BlogEditorContent({
  control,
  getValues,
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
  sidebarOpen,
  onCloseSidebar,
  sidebarTab,
  onSidebarTabChange,
  isMobile,
}: BlogEditorContentProps) {
  const { t } = useTranslation();

  const body = getValues('body');
  const tocItems = parseToc(body);

  const sidebarContent = (
    <BlogEditorSidebar
      activeTab={sidebarTab}
      onTabChange={onSidebarTabChange}
      control={control}
      watch={watch}
      setValue={setValue}
      onSnapshot={onSnapshot}
      blogId={blogId}
      slug={slug}
      canWrite={canWrite}
      siteId={siteId}
      contentId={contentId}
      publishedAt={publishedAt}
      createdAt={createdAt}
      updatedAt={updatedAt}
      categories={categories}
      documents={documents}
    />
  );

  return (
    <Box sx={{ display: 'flex', gap: 0 }}>
      {/* Editor area */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper sx={{ p: 3, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: tocItems.length > 0 ? 9 : 12 }}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('blogDetail.fields.title')}
                    fullWidth
                    required
                    onBlur={() => { field.onBlur(); onSnapshot(); }}
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="subtitle"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('blogDetail.fields.subtitle')}
                    fullWidth
                    onBlur={() => { field.onBlur(); onSnapshot(); }}
                    sx={{ mb: 2 }}
                  />
                )}
              />

              <Controller
                name="body"
                control={control}
                render={({ field }) => (
                  <ForjaEditor
                    value={field.value}
                    onChange={(val) => field.onChange(val)}
                    onBlur={() => { field.onBlur(); onSnapshot(); }}
                    height={500}
                    placeholder={t('editor.placeholder')}
                    siteId={siteId}
                  />
                )}
              />
            </Grid>

            {tocItems.length > 0 && (
              <Grid size={{ xs: 12, md: 3 }}>
                <BlogTocPanel items={tocItems} />
              </Grid>
            )}
          </Grid>
        </Paper>
      </Box>

      {/* Sidebar -- desktop: inline sticky, mobile: Drawer */}
      {isMobile ? (
        <Drawer
          anchor="right"
          open={sidebarOpen}
          onClose={onCloseSidebar}
          PaperProps={{ sx: { width: SIDEBAR_WIDTH, maxWidth: '90vw' } }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        sidebarOpen && (
          <Box
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              borderLeft: 1,
              borderColor: 'divider',
              position: 'sticky',
              top: 128,
              height: 'calc(100vh - 128px)',
              display: 'flex',
              flexDirection: 'column',
              ml: 0,
            }}
          >
            {sidebarContent}
          </Box>
        )
      )}
    </Box>
  );
}
