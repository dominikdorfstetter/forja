import { useState, useRef, useCallback } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
  Alert,
  useTheme,
} from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArticleIcon from '@mui/icons-material/Article';
import SchoolIcon from '@mui/icons-material/School';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CampaignIcon from '@mui/icons-material/Campaign';
import CodeIcon from '@mui/icons-material/Code';
import BuildIcon from '@mui/icons-material/Build';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import StarIcon from '@mui/icons-material/Star';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAiAssist } from '@/hooks/useAiAssist';
import { slugField, requiredString } from '@/utils/validation';
import { slugify } from '@/utils/slugify';
import { validateMarkdownFile, parseMarkdown, type MarkdownParseResult } from '@/utils/markdownImport';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';

type CreationMethod = 'scratch' | 'template' | 'import' | 'ai';
type AiPhase = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };

const scratchSchema = z.object({
  slug: slugField,
  author: requiredString(200),
});

type ScratchFormData = z.infer<typeof scratchSchema>;

const STEP_KEYS = ['blogs.wizard.steps.method', 'blogs.wizard.steps.details'] as const;

const iconMap: Record<string, typeof ArticleIcon> = {
  Article: ArticleIcon,
  School: SchoolIcon,
  NewReleases: NewReleasesIcon,
  RateReview: RateReviewIcon,
  Campaign: CampaignIcon,
  Code: CodeIcon,
  Build: BuildIcon,
  Lightbulb: LightbulbIcon,
  Star: StarIcon,
  Announcement: AnnouncementIcon,
};

interface MergedTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: 'builtin' | 'custom';
  bodyPreview: string;
  builtin?: BlogTemplate;
  custom?: ContentTemplate;
}

const ITEMS_PER_PAGE = 4;

interface CreateBlogWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (blogId: string) => void;
  siteLocales: SiteLocaleResponse[] | undefined;
  siteTemplates: ContentTemplate[] | undefined;
  siteTemplatesLoading: boolean;
}

const EMPTY_TEMPLATES: ContentTemplate[] = [];

export default function CreateBlogWizard({
  open,
  onClose,
  onCreated,
  siteLocales,
  siteTemplates = EMPTY_TEMPLATES,
  siteTemplatesLoading,
}: CreateBlogWizardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { userFullName, isAdmin } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();
  const { isConfigured: aiAvailable, generate: aiGenerate, isGenerating } = useAiAssist();

  const [activeStep, setActiveStep] = useState(0);
  const [method, setMethod] = useState<CreationMethod | null>(null);

  // AI state
  const [aiPhase, setAiPhase] = useState<AiPhase>('idea');
  const [aiIdea, setAiIdea] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiSubtitle, setAiSubtitle] = useState('');
  const [aiOutline, setAiOutline] = useState<OutlineItem[]>([]);
  const outlineIdCounter = useRef(0);
  const [aiBody, setAiBody] = useState('');
  const [aiExcerpt, setAiExcerpt] = useState('');
  const [aiMetaTitle, setAiMetaTitle] = useState('');
  const [aiMetaDescription, setAiMetaDescription] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(0);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPhase, setImportPhase] = useState<'upload' | 'preview'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [parsed, setParsed] = useState<MarkdownParseResult | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importExcerpt, setImportExcerpt] = useState('');
  const [importSlug, setImportSlug] = useState('');

  // Scratch form
  const { register, handleSubmit, reset: resetForm, formState: { errors } } = useForm<ScratchFormData>({
    resolver: zodResolver(scratchSchema),
    defaultValues: { slug: '', author: userFullName || '' },
    mode: 'onChange',
  });

  // Reset all state when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    setActiveStep(0);
    setMethod(null);
    setSelectedTemplate(null);
    setTemplateSearch('');
    setTemplatePage(0);
    setImportPhase('upload');
    setDragOver(false);
    setImportError(null);
    setFileName('');
    setFileSize(0);
    setParsed(null);
    setImportTitle('');
    setImportExcerpt('');
    setImportSlug('');
    setAiPhase('idea');
    setAiIdea('');
    setAiTitle('');
    setAiSubtitle('');
    setAiOutline([]);
    setAiBody('');
    setAiExcerpt('');
    setAiMetaTitle('');
    setAiMetaDescription('');
    setAiError(null);
    resetForm({ slug: '', author: userFullName || '' });
  }
  prevOpenRef.current = open;

  // --- Mutations ---
  const scratchMutation = useMutation({
    mutationFn: (data: ScratchFormData) =>
      apiService.createBlog({
        slug: data.slug,
        author: data.author,
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      }),
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.created'));
      onClose();
      onCreated(blog.id);
    },
    onError: showError,
  });

  const templateMutation = useMutation({
    mutationFn: async ({ template, source }: { template: BlogTemplate | ContentTemplate; source: 'builtin' | 'custom' }) => {
      let slug: string;
      let is_featured: boolean;
      let allow_comments: boolean;
      let content: { title: string; subtitle: string; excerpt: string; body: string; meta_title: string; meta_description: string };

      if (source === 'builtin') {
        const bt = template as BlogTemplate;
        slug = `${bt.defaults.slug}-${Date.now()}`;
        is_featured = bt.defaults.is_featured;
        allow_comments = bt.defaults.allow_comments;
        content = bt.content;
      } else {
        const ct = template as ContentTemplate;
        slug = `${ct.slug_prefix}-${Date.now()}`;
        is_featured = ct.is_featured;
        allow_comments = ct.allow_comments;
        content = {
          title: ct.title,
          subtitle: ct.subtitle,
          excerpt: ct.excerpt,
          body: ct.body,
          meta_title: ct.meta_title,
          meta_description: ct.meta_description,
        };
      }

      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured,
        allow_comments,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: content.title,
          subtitle: content.subtitle,
          excerpt: content.excerpt,
          body: content.body,
          meta_title: content.meta_title,
          meta_description: content.meta_description,
        });
      }
      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.created'));
      onClose();
      onCreated(blog.id);
    },
    onError: showError,
  });

  const importMutation = useMutation({
    mutationFn: async (result: MarkdownParseResult) => {
      const blog = await apiService.createBlog({
        slug: result.slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: result.title,
          excerpt: result.excerpt,
          body: result.body,
          meta_title: result.meta_title,
        });
      }
      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.created'));
      onClose();
      onCreated(blog.id);
    },
    onError: showError,
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const slug = slugify(aiTitle) || `ai-post-${Date.now()}`;
      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: aiTitle,
          subtitle: aiSubtitle || undefined,
          excerpt: aiExcerpt || undefined,
          body: aiBody || undefined,
          meta_title: aiMetaTitle || undefined,
          meta_description: aiMetaDescription || undefined,
        });
      }
      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('blogs.messages.created'));
      onClose();
      onCreated(blog.id);
    },
    onError: showError,
  });

  const isCreating = scratchMutation.isPending || templateMutation.isPending || importMutation.isPending || aiMutation.isPending;

  // --- AI handlers ---
  const handleAiGenerateOutline = async () => {
    setAiError(null);
    try {
      const result = await aiGenerate('draft_outline', aiIdea);
      if (result.title) setAiTitle(result.title);
      if (result.subtitle) setAiSubtitle(result.subtitle);
      if (result.outline) setAiOutline(result.outline.map((v: string) => ({ id: outlineIdCounter.current++, value: v })));
      setAiPhase('outline');
    } catch {
      setAiError(t('quickPost.ai.outlineError'));
    }
  };

  const handleAiGeneratePost = async () => {
    setAiError(null);
    const content = JSON.stringify({
      title: aiTitle,
      subtitle: aiSubtitle,
      outline: aiOutline.map(item => item.value),
    });
    try {
      const result = await aiGenerate('draft_post', content);
      if (result.body) setAiBody(result.body);
      if (result.excerpt) setAiExcerpt(result.excerpt);
      if (result.meta_title) setAiMetaTitle(result.meta_title);
      if (result.meta_description) setAiMetaDescription(result.meta_description);
      setAiPhase('post');
    } catch {
      setAiError(t('quickPost.ai.postError'));
    }
  };

  // --- Template helpers ---
  const mergedTemplates = (() => {
    const builtins: MergedTemplate[] = blogTemplates.map((tpl) => ({
      id: `builtin-${tpl.id}`,
      name: t(tpl.nameKey),
      description: t(tpl.descriptionKey),
      icon: tpl.icon,
      source: 'builtin' as const,
      bodyPreview: tpl.content.body.trimStart().slice(0, 100),
      builtin: tpl,
    }));
    const customs: MergedTemplate[] = (siteTemplates || [])
      .filter((tpl) => tpl.is_active)
      .map((tpl) => ({
        id: `custom-${tpl.id}`,
        name: tpl.name,
        description: tpl.description || '',
        icon: tpl.icon,
        source: 'custom' as const,
        bodyPreview: tpl.body.trimStart().slice(0, 100),
        custom: tpl,
      }));
    return [...builtins, ...customs];
  })();

  const filteredTemplates = (() => {
    if (!templateSearch.trim()) return mergedTemplates;
    const q = templateSearch.toLowerCase();
    return mergedTemplates.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
    );
  })();

  const totalTemplatePages = Math.max(1, Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE));
  const currentTemplatePage = Math.min(templatePage, totalTemplatePages - 1);
  const pageTemplateItems = filteredTemplates.slice(currentTemplatePage * ITEMS_PER_PAGE, (currentTemplatePage + 1) * ITEMS_PER_PAGE);

  const handleTemplateConfirm = () => {
    const tpl = mergedTemplates.find((t) => t.id === selectedTemplate);
    if (!tpl) return;
    if (tpl.source === 'builtin' && tpl.builtin) {
      templateMutation.mutate({ template: tpl.builtin, source: 'builtin' });
    } else if (tpl.source === 'custom' && tpl.custom) {
      templateMutation.mutate({ template: tpl.custom, source: 'custom' });
    }
  };

  // --- Import helpers ---
  const processFile = useCallback(async (file: File) => {
    setImportError(null);
    const validationError = validateMarkdownFile(file);
    if (validationError) {
      setImportError(t(validationError));
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    let content: string;
    try {
      content = await file.text();
    } catch {
      setImportError(t('markdownImport.errors.readFailed'));
      return;
    }
    const { result, error: parseError } = parseMarkdown(content);
    if (parseError) {
      setImportError(t(parseError, { max: parseError.includes('title') ? 500 : 200000 }));
      return;
    }
    if (result) {
      setParsed(result);
      setImportTitle(result.title);
      setImportExcerpt(result.excerpt);
      setImportSlug(result.slug);
      setImportPhase('preview');
    }
  }, [t]);

  const handleImportConfirm = () => {
    if (!parsed) return;
    importMutation.mutate({
      ...parsed,
      title: importTitle,
      excerpt: importExcerpt,
      slug: importSlug,
      meta_title: importTitle.slice(0, 200),
    });
  };

  // --- Step navigation ---
  const handleMethodSelect = (m: CreationMethod) => {
    setMethod(m);
    setActiveStep(1);
  };

  const handleBack = () => {
    if (method === 'import' && importPhase === 'preview') {
      setImportPhase('upload');
      setImportError(null);
      return;
    }
    if (method === 'ai') {
      if (aiPhase === 'post') {
        setAiPhase('outline');
        return;
      }
      if (aiPhase === 'outline') {
        setAiPhase('idea');
        return;
      }
    }
    setActiveStep(0);
    setMethod(null);
  };

  const handleScratchSubmit = (data: ScratchFormData) => {
    scratchMutation.mutate(data);
  };

  // --- Method cards for Step 0 ---
  const methodCards: { key: CreationMethod; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
    ...(aiAvailable
      ? [{ key: 'ai' as const, icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.ai', descKey: 'blogs.wizard.methods.aiDesc' }]
      : []),
    { key: 'scratch', icon: <CreateIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.scratch', descKey: 'blogs.wizard.methods.scratchDesc' },
    { key: 'template', icon: <DescriptionIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.template', descKey: 'blogs.wizard.methods.templateDesc' },
    { key: 'import', icon: <UploadFileIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.import', descKey: 'blogs.wizard.methods.importDesc' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth={method === 'template' || method === 'ai' || (activeStep === 0 && aiAvailable) ? 'md' : 'sm'} fullWidth aria-labelledby="create-blog-wizard-title" data-testid="create-blog-wizard">
      <DialogTitle id="create-blog-wizard-title">{t('blogs.wizard.title')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0 — Choose method */}
        {activeStep === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {methodCards.map(({ key, icon, labelKey, descKey }) => (
              <Card
                key={key}
                variant="outlined"
                sx={{
                  border: 2,
                  borderColor: method === key ? 'primary.main' : 'divider',
                  bgcolor: method === key ? 'action.selected' : 'background.paper',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  display: 'flex',
                }}
              >
                <CardActionArea
                  onClick={() => handleMethodSelect(key)}
                  sx={{ p: 2.5, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                >
                  <Box sx={{ color: method === key ? 'primary.main' : 'text.secondary', mb: 1 }}>
                    {icon}
                  </Box>
                  <Typography variant="body2" fontWeight={600}>{t(labelKey)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, mt: 0.5 }}>
                    {t(descKey)}
                  </Typography>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}

        {/* Step 1 — From Scratch */}
        {activeStep === 1 && method === 'scratch' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label={t('blogs.wizard.fields.slug')}
              fullWidth
              required
              {...register('slug')}
              error={!!errors.slug}
              helperText={errors.slug?.message || t('blogs.wizard.fields.slugHint')}
              data-testid="create-blog-wizard.input.slug"
            />
            <TextField
              label={t('blogs.wizard.fields.author')}
              fullWidth
              required
              {...register('author')}
              error={!!errors.author}
              helperText={errors.author?.message}
              data-testid="create-blog-wizard.input.author"
            />
          </Box>
        )}

        {/* Step 1 — From Template */}
        {activeStep === 1 && method === 'template' && (
          <>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder={t('templates.searchPlaceholder')}
              value={templateSearch}
              onChange={(e) => { setTemplateSearch(e.target.value); setTemplatePage(0); setSelectedTemplate(null); }}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {siteTemplatesLoading ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {t('common.actions.loading')}
              </Typography>
            ) : filteredTemplates.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {t('templates.noResults')}
              </Typography>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, minHeight: 280 }}>
                  {pageTemplateItems.map((template) => {
                    const Icon = iconMap[template.icon] || ArticleIcon;
                    const isSelected = selectedTemplate === template.id;
                    return (
                      <CardActionArea
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        sx={{
                          borderRadius: 2,
                          border: 2,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                          transition: 'all 0.15s ease-in-out',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          height: '100%',
                          '&:hover': { borderColor: isSelected ? 'primary.main' : 'action.hover' },
                        }}
                      >
                        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 1.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.action.active, 0.08),
                                }}
                              >
                                <Icon sx={{ fontSize: 22, color: isSelected ? 'primary.main' : 'action.active' }} />
                              </Box>
                              <Chip
                                label={template.source === 'builtin' ? t('templates.builtIn') : t('templates.custom')}
                                size="small"
                                variant="outlined"
                                color={template.source === 'builtin' ? 'default' : 'secondary'}
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            </Box>
                            {isSelected && <CheckCircleIcon color="primary" sx={{ fontSize: 22 }} />}
                          </Box>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>{template.name}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>{template.description}</Typography>
                          <Box sx={{ mt: 'auto', p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.action.active, 0.04) }}>
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              component="pre"
                              sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', m: 0 }}
                            >
                              {template.bodyPreview}
                            </Typography>
                          </Box>
                        </Box>
                      </CardActionArea>
                    );
                  })}
                </Box>
                {totalTemplatePages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
                    <IconButton size="small" disabled={currentTemplatePage === 0} onClick={() => setTemplatePage(prev => prev - 1)}>
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Typography variant="body2" color="text.secondary">
                      {t('templates.page', { current: currentTemplatePage + 1, total: totalTemplatePages })}
                    </Typography>
                    <IconButton size="small" disabled={currentTemplatePage >= totalTemplatePages - 1} onClick={() => setTemplatePage(prev => prev + 1)}>
                      <NavigateNextIcon />
                    </IconButton>
                  </Box>
                )}
              </>
            )}
          </>
        )}

        {/* Step 1 — Import Markdown */}
        {activeStep === 1 && method === 'import' && (
          <>
            {importPhase === 'upload' && (
              <>
                <Box
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: '2px dashed',
                    borderColor: dragOver ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: dragOver ? 'action.hover' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
                  }}
                >
                  <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body1">
                    {dragOver ? t('markdownImport.dropZoneActive') : t('markdownImport.dropZone')}
                  </Typography>
                </Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown"
                  hidden
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }}
                />
                {fileName && !importError && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {fileName} ({(fileSize / 1024).toFixed(1)} KB)
                  </Typography>
                )}
              </>
            )}
            {importPhase === 'preview' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('markdownImport.titleLabel')} value={importTitle} onChange={(e) => setImportTitle(e.target.value)} fullWidth />
                <TextField label={t('markdownImport.excerptLabel')} value={importExcerpt} onChange={(e) => setImportExcerpt(e.target.value)} fullWidth multiline rows={2} />
                <TextField label={t('markdownImport.slugLabel')} value={importSlug} onChange={(e) => setImportSlug(e.target.value)} fullWidth InputProps={{ sx: { fontFamily: 'monospace' } }} />
                <TextField
                  label={t('markdownImport.bodyPreview')}
                  value={parsed?.body || ''}
                  fullWidth
                  multiline
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' } }}
                />
              </Box>
            )}
            {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
          </>
        )}

        {/* Step 1 — AI Assist */}
        {activeStep === 1 && method === 'ai' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isGenerating && <LinearProgress />}
            {aiError && (
              <Alert severity="error" onClose={() => setAiError(null)}>
                {aiError}
              </Alert>
            )}

            {/* AI Phase 1: Idea */}
            {aiPhase === 'idea' && (
              <>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('quickPost.ai.ideaTitle')}
                </Typography>
                <TextField
                  placeholder={t('quickPost.ai.ideaPlaceholder')}
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={8}
                  value={aiIdea}
                  onChange={(e) => setAiIdea(e.target.value)}
                  disabled={isGenerating}
                  autoFocus
                />
              </>
            )}

            {/* AI Phase 2: Outline Review */}
            {aiPhase === 'outline' && (
              <>
                <TextField
                  label={t('quickPost.ai.titleLabel')}
                  fullWidth
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  disabled={isGenerating}
                />
                <TextField
                  label={t('quickPost.ai.subtitleLabel')}
                  fullWidth
                  value={aiSubtitle}
                  onChange={(e) => setAiSubtitle(e.target.value)}
                  disabled={isGenerating}
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('quickPost.ai.outlineLabel')}
                  </Typography>
                  <Stack spacing={1}>
                    {aiOutline.map((item, index) => (
                      <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                        <Chip label={index + 1} size="small" variant="outlined" />
                        <TextField
                          fullWidth
                          size="small"
                          value={item.value}
                          onChange={(e) => setAiOutline((prev) => prev.map((v) => (v.id === item.id ? { ...v, value: e.target.value } : v)))}
                          disabled={isGenerating}
                        />
                        <Tooltip title={t('common.actions.delete')} arrow>
                          <IconButton
                            size="small"
                            onClick={() => setAiOutline((prev) => prev.filter((v) => v.id !== item.id))}
                            disabled={isGenerating}
                            aria-label={t('common.actions.delete')}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                    <Button size="small" onClick={() => setAiOutline((prev) => [...prev, { id: outlineIdCounter.current++, value: '' }])} disabled={isGenerating}>
                      {t('quickPost.ai.addPoint')}
                    </Button>
                  </Stack>
                </Box>
              </>
            )}

            {/* AI Phase 3: Post Preview */}
            {aiPhase === 'post' && (
              <>
                <TextField
                  label={t('quickPost.ai.titleLabel')}
                  fullWidth
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  disabled={isCreating}
                />
                <TextField
                  label={t('blogDetail.fields.body')}
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={12}
                  value={aiBody}
                  onChange={(e) => setAiBody(e.target.value)}
                  disabled={isCreating}
                  InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
                />
                <TextField
                  label={t('blogDetail.fields.excerpt')}
                  fullWidth
                  multiline
                  rows={2}
                  value={aiExcerpt}
                  onChange={(e) => setAiExcerpt(e.target.value)}
                  disabled={isCreating}
                />
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {activeStep === 1 && method === 'template' && isAdmin && (
            <Button
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => { onClose(); navigate('/blogs/templates'); }}
            >
              {t('templates.manageTemplates')}
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={isCreating}>{t('common.actions.cancel')}</Button>
          {activeStep === 1 && (
            <Button onClick={handleBack} disabled={isCreating} data-testid="create-blog-wizard.btn.back">{t('common.actions.back')}</Button>
          )}

          {/* Scratch: submit */}
          {activeStep === 1 && method === 'scratch' && (
            <Button variant="contained" onClick={handleSubmit(handleScratchSubmit)} disabled={isCreating} data-testid="create-blog-wizard.btn.create">
              {isCreating ? t('blogs.wizard.creating') : t('blogs.wizard.create')}
            </Button>
          )}

          {/* Template: confirm */}
          {activeStep === 1 && method === 'template' && (
            <Button variant="contained" onClick={handleTemplateConfirm} disabled={!selectedTemplate || isCreating}>
              {isCreating ? t('blogs.wizard.creating') : t('templates.useTemplate')}
            </Button>
          )}

          {/* Import: confirm */}
          {activeStep === 1 && method === 'import' && importPhase === 'preview' && (
            <Button variant="contained" onClick={handleImportConfirm} disabled={isCreating || !importTitle.trim() || !importSlug.trim()}>
              {isCreating ? t('blogs.wizard.creating') : t('markdownImport.import')}
            </Button>
          )}

          {/* AI: phase-specific actions */}
          {activeStep === 1 && method === 'ai' && aiPhase === 'idea' && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleAiGenerateOutline}
              disabled={isGenerating || !aiIdea.trim()}
            >
              {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generateOutline')}
            </Button>
          )}
          {activeStep === 1 && method === 'ai' && aiPhase === 'outline' && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleAiGeneratePost}
              disabled={isGenerating || !aiTitle.trim() || aiOutline.length === 0}
            >
              {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generatePost')}
            </Button>
          )}
          {activeStep === 1 && method === 'ai' && aiPhase === 'post' && (
            <Button variant="contained" onClick={() => aiMutation.mutate()} disabled={isCreating || !aiTitle.trim()}>
              {isCreating ? t('blogs.wizard.creating') : t('blogs.wizard.create')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
