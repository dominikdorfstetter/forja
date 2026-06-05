import { Box, Tabs, Tab } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import { useTranslation } from 'react-i18next';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import type {
  PageResponse,
  PageSectionResponse,
  SectionLocalizationResponse,
  CreatePageSectionRequest,
  ReorderItem,
} from '@/types/api';
import { pageTabsSx } from '@/components/shared/listPageV2';
import type { PageDetailFormData } from './pageDetailSchema';
import PageInfoTab from './PageInfoTab';
import PageSectionsTab from './PageSectionsTab';
import PageSeoTab from './PageSeoTab';

interface PageDetailTabContentProps {
  activeTab: number;
  onTabChange: (tab: number) => void;
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  setValue?: UseFormSetValue<PageDetailFormData>;
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
  setValue,
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
    { key: 'info', label: t('pageDetail.tabs.info'), icon: <InfoOutlinedIcon fontSize="small" /> },
    { key: 'seo', label: t('pageDetail.tabs.seo'), icon: <TravelExploreIcon fontSize="small" /> },
    { key: 'sections', label: t('pageDetail.tabs.sections'), icon: <ViewAgendaOutlinedIcon fontSize="small" /> },
  ];

  return (
    <Box
      sx={{
        mb: 2,
        bgcolor: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ ...pageTabsSx, mb: 0, px: 1 }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.key} icon={tab.icon} iconPosition="start" label={tab.label} />
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
            setValue={setValue}
            onSnapshot={onSnapshot}
            route={page.route}
            pageId={pageId}
            activeLocales={activeLocales}
            sectionLocalizations={sectionLocalizations}
          />
        )}
        {activeTab === 2 && (
          <PageSectionsTab
            pageId={pageId}
            pageRoute={page.route}
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
    </Box>
  );
}
