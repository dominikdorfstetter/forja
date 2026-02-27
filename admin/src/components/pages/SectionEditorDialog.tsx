import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  PageSectionResponse,
  UpdatePageSectionRequest,
  SectionLocalizationResponse,
  UpsertSectionLocalizationRequest,
} from '@/types/api';
import SectionSettingsForm from './SectionSettingsForm';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';

interface SectionEditorDialogProps {
  open: boolean;
  section: PageSectionResponse | null;
  onClose: () => void;
}

export default function SectionEditorDialog({ open, section, onClose }: SectionEditorDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();

  // Locale tab state
  const [activeTab, setActiveTab] = useState(0);

  // Localization form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [buttonText, setButtonText] = useState('');

  // Section metadata form state
  const [displayOrder, setDisplayOrder] = useState(0);
  const [coverImageId, setCoverImageId] = useState('');
  const [ctaRoute, setCtaRoute] = useState('');
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  // Queries
  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: localizations } = useQuery({
    queryKey: ['section-localizations', section?.id],
    queryFn: () => apiService.getSectionLocalizations(section!.id),
    enabled: !!section,
  });

  const activeLocales = (siteLocalesRaw || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));
  const currentLocale = activeLocales[activeTab];

  // Populate localization form when switching tabs or data loads
  const populateLocForm = (loc: SectionLocalizationResponse | undefined) => {
    setTitle(loc?.title || '');
    setText(loc?.text || '');
    setButtonText(loc?.button_text || '');
  };

  const handleTabChange = (_: unknown, newValue: number) => {
    setActiveTab(newValue);
    const locale = activeLocales[newValue];
    const loc = localizations?.find((l) => locale && l.locale_id === locale.id);
    populateLocForm(loc);
  };

  // Initialize section metadata when dialog opens or section changes
  useEffect(() => {
    if (open && section) {
      setDisplayOrder(section.display_order);
      setCoverImageId(section.cover_image_id || '');
      setCtaRoute(section.call_to_action_route || '');
      setSettings(section.settings ? { ...section.settings } : {});
      setActiveTab(0);
    }
  }, [open, section?.id]);

  // Initialize localization form when data loads
  useMemo(() => {
    if (localizations && currentLocale) {
      const loc = localizations.find((l) => l.locale_id === currentLocale.id);
      populateLocForm(loc);
    }
  }, [localizations, currentLocale?.id]);

  // Mutations
  const upsertLocMutation = useMutation({
    mutationFn: (data: UpsertSectionLocalizationRequest) =>
      apiService.upsertSectionLocalization(section!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-localizations', section?.id] });
      queryClient.invalidateQueries({ queryKey: ['page-section-localizations'] });
      enqueueSnackbar('Localization saved', { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title: errTitle } = resolveError(error);
      enqueueSnackbar(detail || errTitle, { variant: 'error' });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: (data: UpdatePageSectionRequest) =>
      apiService.updatePageSection(section!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', section?.page_id] });
      enqueueSnackbar('Section settings saved', { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title: errTitle } = resolveError(error);
      enqueueSnackbar(detail || errTitle, { variant: 'error' });
    },
  });

  const handleSaveLocalization = () => {
    if (!currentLocale) return;
    upsertLocMutation.mutate({
      locale_id: currentLocale.id,
      title: title || undefined,
      text: text || undefined,
      button_text: buttonText || undefined,
    });
  };

  const handleSaveSection = () => {
    updateSectionMutation.mutate({
      display_order: displayOrder,
      cover_image_id: coverImageId || undefined,
      call_to_action_route: ctaRoute || undefined,
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    });
  };

  if (!section) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {t('forms.section.title')}
          <Chip label={section.section_type} size="small" color="primary" variant="outlined" />
        </Box>
        <IconButton onClick={onClose} size="small" aria-label={t('common.actions.close')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Left panel: Localized content (60%) */}
          <Grid item xs={12} md={7}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Localized Content
            </Typography>

            {activeLocales.length > 0 ? (
              <>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ mb: 2 }}
                >
                  {activeLocales.map((locale) => {
                    const hasLoc = localizations?.some((l) => l.locale_id === locale.id);
                    return (
                      <Tab
                        key={locale.id}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {locale.code.toUpperCase()}
                            {hasLoc && (
                              <Chip
                                label="exists"
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        }
                      />
                    );
                  })}
                </Tabs>

                <Stack spacing={2}>
                  <TextField
                    label={t('blogDetail.fields.title')}
                    fullWidth
                    size="small"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      Text (Markdown)
                    </Typography>
                    <MDEditor
                      value={text}
                      onChange={(val) => setText(val || '')}
                      height={250}
                      preview="edit"
                      commands={[
                        commands.bold, commands.italic, commands.strikethrough,
                        commands.divider,
                        commands.heading, commands.quote, commands.link, commands.image,
                        commands.divider,
                        commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
                        commands.divider,
                        commands.code, commands.codeBlock,
                        commands.divider,
                        commands.table, commands.hr,
                      ]}
                      extraCommands={[
                        commands.codeEdit, commands.codeLive, commands.codePreview,
                        commands.divider,
                        commands.fullscreen,
                      ]}
                    />
                  </Box>

                  <TextField
                    label="Button Text"
                    fullWidth

                    size="small"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                  />

                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveLocalization}
                    disabled={upsertLocMutation.isPending || !currentLocale}
                  >
                    {upsertLocMutation.isPending ? t('common.actions.saving') : `${t('common.actions.save')} ${currentLocale?.code.toUpperCase() || ''}`}
                  </Button>
                </Stack>
              </>
            ) : (
              <Typography color="text.secondary">No active locales configured</Typography>
            )}
          </Grid>

          {/* Right panel: Section configuration (40%) */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Section Configuration
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('forms.section.fields.sectionType')}</Typography>
                <Box><Chip label={section.section_type} size="small" variant="outlined" /></Box>
              </Box>

              <TextField
                label={t('forms.section.fields.displayOrder')}
                type="number"
                fullWidth
                size="small"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />

              <TextField
                label="Cover Image ID"
                fullWidth
                size="small"
                value={coverImageId}
                onChange={(e) => setCoverImageId(e.target.value)}
                helperText="Optional media asset UUID"
              />

              <TextField
                label="Call to Action Route"
                fullWidth
                size="small"
                value={ctaRoute}
                onChange={(e) => setCtaRoute(e.target.value)}
                helperText="Optional CTA link route"
              />

              <Divider />

              <SectionSettingsForm
                sectionType={section.section_type}
                settings={settings}
                onChange={setSettings}
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveSection}
                disabled={updateSectionMutation.isPending}
              >
                {updateSectionMutation.isPending ? t('common.actions.saving') : t('common.actions.save')}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
