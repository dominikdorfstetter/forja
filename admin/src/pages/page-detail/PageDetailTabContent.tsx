import { Box, Tabs, Tab, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Control, UseFormWatch } from 'react-hook-form';
import type {
  PageResponse,
  PageSectionResponse,
  SectionLocalizationResponse,
  CreatePageSectionRequest,
  ReorderItem,
} from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';
import PageInfoTab from './PageInfoTab';
import PageSectionsTab from './PageSectionsTab';
import PageSeoTab from './PageSeoTab';

interface PageDetailTabContentProps {
  activeTab: number;
  onTabChange: (tab: number) => void;
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  page: PageResponse;
  onSnapshot: () => void;
  pageId: string;
  sections: PageSectionResponse[] | undefined;
  sectionsLoading: boolean;
  sectionLocalizations: SectionLocalizationResponse[] | undefined;
  activeLocales: { id: string; code: string }[];
  canWrite: boolean;
  isAdmin: boolean;
  onCreateSection: (data: CreatePageSectionRequest) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (items: ReorderItem[]) => void;
  onSectionEditorClose: () => void;
  createLoading: boolean;
  deleteLoading: boolean;
}

export default function PageDetailTabContent({
  activeTab,
  onTabChange,
  control,
  watch,
  page,
  onSnapshot,
  pageId,
  sections,
  sectionsLoading,
  sectionLocalizations,
  activeLocales,
  canWrite,
  isAdmin,
  onCreateSection,
  onDeleteSection,
  onReorderSections,
  onSectionEditorClose,
  createLoading,
  deleteLoading,
}: PageDetailTabContentProps) {
  const { t } = useTranslation();

  const tabs = [
    { key: 'info', label: t('pageDetail.tabs.info') },
    { key: 'seo', label: t('pageDetail.tabs.seo') },
    { key: 'sections', label: t('pageDetail.tabs.sections') },
  ];

  return (
    <Paper sx={{ mb: 2 }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.key} label={tab.label} />
        ))}
      </Tabs>

      <Box sx={{ p: 3 }}>
        {activeTab === 0 && (
          <PageInfoTab
            control={control}
            watch={watch}
            page={page}
            onSnapshot={onSnapshot}
          />
        )}
        {activeTab === 1 && (
          <PageSeoTab
            control={control}
            watch={watch}
            onSnapshot={onSnapshot}
            route={page.route}
          />
        )}
        {activeTab === 2 && (
          <PageSectionsTab
            pageId={pageId}
            sections={sections}
            sectionsLoading={sectionsLoading}
            sectionLocalizations={sectionLocalizations}
            activeLocales={activeLocales}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onCreateSection={onCreateSection}
            onDeleteSection={onDeleteSection}
            onReorderSections={onReorderSections}
            onSectionEditorClose={onSectionEditorClose}
            createLoading={createLoading}
            deleteLoading={deleteLoading}
          />
        )}
      </Box>
    </Paper>
  );
}
