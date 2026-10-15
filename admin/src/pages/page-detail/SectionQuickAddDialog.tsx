import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import GridViewIcon from '@mui/icons-material/GridView';
import CampaignIcon from '@mui/icons-material/Campaign';
import CollectionsIcon from '@mui/icons-material/Collections';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ExtensionIcon from '@mui/icons-material/Extension';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupIcon from '@mui/icons-material/Group';
import TimelineIcon from '@mui/icons-material/Timeline';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import VideocamIcon from '@mui/icons-material/Videocam';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { useTranslation } from 'react-i18next';
import type { CreatePageSectionRequest, SectionType } from '@/types/api';
import FormDialog from '@/components/shared/FormDialog';

const SECTION_TYPE_CONFIG: { type: SectionType; icon: React.ReactNode; descriptionKey: string }[] = [
  { type: 'Hero', icon: <ViewCarouselIcon />, descriptionKey: 'sectionEditor.types.Hero' },
  { type: 'Features', icon: <GridViewIcon />, descriptionKey: 'sectionEditor.types.Features' },
  { type: 'Cta', icon: <CampaignIcon />, descriptionKey: 'sectionEditor.types.Cta' },
  { type: 'Gallery', icon: <CollectionsIcon />, descriptionKey: 'sectionEditor.types.Gallery' },
  { type: 'Testimonials', icon: <FormatQuoteIcon />, descriptionKey: 'sectionEditor.types.Testimonials' },
  { type: 'Pricing', icon: <AttachMoneyIcon />, descriptionKey: 'sectionEditor.types.Pricing' },
  { type: 'Faq', icon: <HelpOutlineIcon />, descriptionKey: 'sectionEditor.types.Faq' },
  { type: 'Contact', icon: <ContactMailIcon />, descriptionKey: 'sectionEditor.types.Contact' },
  { type: 'Custom', icon: <ExtensionIcon />, descriptionKey: 'sectionEditor.types.Custom' },
  { type: 'Stats', icon: <BarChartIcon />, descriptionKey: 'sectionEditor.types.Stats' },
  { type: 'Team', icon: <GroupIcon />, descriptionKey: 'sectionEditor.types.Team' },
  { type: 'Timeline', icon: <TimelineIcon />, descriptionKey: 'sectionEditor.types.Timeline' },
  { type: 'LogoCloud', icon: <BusinessIcon />, descriptionKey: 'sectionEditor.types.LogoCloud' },
  { type: 'Newsletter', icon: <EmailIcon />, descriptionKey: 'sectionEditor.types.Newsletter' },
  { type: 'Video', icon: <VideocamIcon />, descriptionKey: 'sectionEditor.types.Video' },
  { type: 'Divider', icon: <HorizontalRuleIcon />, descriptionKey: 'sectionEditor.types.Divider' },
  { type: 'Text', icon: <TextFieldsIcon />, descriptionKey: 'sectionEditor.types.Text' },
];

/** Section-type picker that creates a new section at `nextOrder`. */
export default function SectionQuickAddDialog({
  open,
  onSubmit,
  onClose,
  loading,
  nextOrder,
}: {
  open: boolean;
  onSubmit: (data: CreatePageSectionRequest) => void;
  onClose: () => void;
  loading?: boolean;
  nextOrder: number;
}) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<SectionType>('Hero');

  // react-doctor-disable-next-line useEffect-event-handler — resets state on dialog open transition
  useEffect(() => {
    if (open) setSelectedType('Hero');
  }, [open]);

  const handleAdd = () => {
    onSubmit({
      section_type: selectedType,
      display_order: nextOrder,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleAdd}
      icon="view_quilt"
      title={t('pageDetail.sections.add')}
      submitLabel={loading ? t('pageDetail.dialog.adding') : t('common.actions.add')}
      loading={loading}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {SECTION_TYPE_CONFIG.map(({ type, icon, descriptionKey }) => (
          <Card
            key={type}
            variant="outlined"
            sx={{
              border: 2,
              borderColor: selectedType === type ? 'primary.main' : 'divider',
              bgcolor: selectedType === type ? 'action.selected' : 'background.paper',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
          >
            <CardActionArea
              onClick={() => setSelectedType(type)}
              sx={{ p: 1.5, textAlign: 'center' }}
            >
              <Box sx={{ color: selectedType === type ? 'primary.main' : 'text.secondary', mb: 0.5 }}>
                {icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(`sectionEditor.typeNames.${type}`)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                {t(descriptionKey)}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </FormDialog>
  );
}
