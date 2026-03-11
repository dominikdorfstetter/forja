import { useState, useEffect, useRef, useCallback } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Step,
  StepLabel,
  Stepper,
  TextField,
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
import { useTranslation } from 'react-i18next';
import type { CreateContentTemplateRequest } from '@/types/api';
import { validateMarkdownFile, parseMarkdown, type MarkdownParseResult } from '@/utils/markdownImport';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';

type CreationMethod = 'scratch' | 'template' | 'import';

const STEP_KEYS = ['contentTemplates.wizard.steps.method', 'contentTemplates.wizard.steps.details'] as const;

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
  bodyPreview: string;
  builtin: BlogTemplate;
}

const ITEMS_PER_PAGE = 4;

interface CreateTemplateWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateContentTemplateRequest) => void;
  loading?: boolean;
}

export default function CreateTemplateWizard({ open, onClose, onSubmit, loading }: CreateTemplateWizardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [activeStep, setActiveStep] = useState(0);
  const [method, setMethod] = useState<CreationMethod | null>(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(0);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [parsed, setParsed] = useState<MarkdownParseResult | null>(null);

  // Scratch form state
  const [name, setName] = useState('');
  const [slugPrefix, setSlugPrefix] = useState('post');
  const [body, setBody] = useState('');

  // Shared editable fields for import/template prefill
  const [editName, setEditName] = useState('');
  const [editSlugPrefix, setEditSlugPrefix] = useState('');
  const [editBody, setEditBody] = useState('');

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setMethod(null);
      setSelectedTemplate(null);
      setTemplateSearch('');
      setTemplatePage(0);
      setDragOver(false);
      setImportError(null);
      setFileName('');
      setFileSize(0);
      setParsed(null);
      setName('');
      setSlugPrefix('post');
      setBody('');
      setEditName('');
      setEditSlugPrefix('');
      setEditBody('');
    }
  }, [open]);

  // --- Template helpers ---
  const mergedTemplates: MergedTemplate[] = blogTemplates.map((tpl) => ({
    id: tpl.id,
    name: t(tpl.nameKey),
    description: t(tpl.descriptionKey),
    icon: tpl.icon,
    bodyPreview: tpl.content.body.trimStart().slice(0, 100),
    builtin: tpl,
  }));

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
      setEditName(result.title);
      setEditSlugPrefix(result.slug.replace(/-\d+$/, ''));
      setEditBody(result.body);
    }
  }, [t]);

  // --- Confirm handlers ---
  const handleScratchSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      slug_prefix: slugPrefix || 'post',
      body: body || undefined,
      icon: 'Article',
      is_featured: false,
      allow_comments: true,
    });
  };

  const handleTemplateConfirm = () => {
    const tpl = mergedTemplates.find((t) => t.id === selectedTemplate);
    if (!tpl) return;
    const bt = tpl.builtin;
    onSubmit({
      name: tpl.name,
      description: tpl.description,
      icon: tpl.icon,
      slug_prefix: bt.defaults.slug,
      is_featured: bt.defaults.is_featured,
      allow_comments: bt.defaults.allow_comments,
      title: bt.content.title,
      subtitle: bt.content.subtitle,
      excerpt: bt.content.excerpt,
      body: bt.content.body,
      meta_title: bt.content.meta_title,
      meta_description: bt.content.meta_description,
    });
  };

  const handleImportConfirm = () => {
    if (!parsed || !editName.trim()) return;
    onSubmit({
      name: editName.trim(),
      slug_prefix: editSlugPrefix || 'post',
      body: editBody,
      title: parsed.title,
      excerpt: parsed.excerpt,
      meta_title: parsed.meta_title,
      icon: 'Article',
      is_featured: false,
      allow_comments: true,
    });
  };

  // --- Step navigation ---
  const handleMethodSelect = (m: CreationMethod) => {
    setMethod(m);
    setActiveStep(1);
  };

  const handleBack = () => {
    setActiveStep(0);
    setMethod(null);
  };

  // --- Method cards for Step 0 ---
  const methodCards: { key: CreationMethod; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
    { key: 'scratch', icon: <CreateIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.scratch', descKey: 'contentTemplates.wizard.methods.scratchDesc' },
    { key: 'template', icon: <DescriptionIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.template', descKey: 'contentTemplates.wizard.methods.templateDesc' },
    { key: 'import', icon: <UploadFileIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.import', descKey: 'contentTemplates.wizard.methods.importDesc' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth={method === 'template' ? 'md' : 'sm'} fullWidth aria-labelledby="create-template-wizard-title" data-testid="create-template-wizard">
      <DialogTitle id="create-template-wizard-title">{t('contentTemplates.wizard.title')}</DialogTitle>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {methodCards.map(({ key, icon, labelKey, descKey }) => (
              <Card
                key={key}
                variant="outlined"
                sx={{
                  border: 2,
                  borderColor: method === key ? 'primary.main' : 'divider',
                  bgcolor: method === key ? 'action.selected' : 'background.paper',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <CardActionArea onClick={() => handleMethodSelect(key)} sx={{ p: 2.5, textAlign: 'center' }}>
                  <Box sx={{ color: method === key ? 'primary.main' : 'text.secondary', mb: 1 }}>{icon}</Box>
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
            <TextField autoFocus label={t('forms.contentTemplate.fields.name')} fullWidth required value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label={t('forms.contentTemplate.fields.slugPrefix')} fullWidth value={slugPrefix} onChange={(e) => setSlugPrefix(e.target.value)} helperText={t('contentTemplates.wizard.slugPrefixHint')} />
            <TextField label={t('forms.contentTemplate.fields.body')} fullWidth multiline rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </Box>
        )}

        {/* Step 1 — From Built-in Template */}
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
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            {filteredTemplates.length === 0 ? (
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
                            <Box
                              sx={{
                                width: 40, height: 40, borderRadius: 1.5,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.action.active, 0.08),
                              }}
                            >
                              <Icon sx={{ fontSize: 22, color: isSelected ? 'primary.main' : 'action.active' }} />
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
            {!parsed ? (
              <>
                <Box
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: '2px dashed',
                    borderColor: dragOver ? 'primary.main' : 'divider',
                    borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
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
                <input ref={fileInputRef} type="file" accept=".md,.markdown" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }} />
                {fileName && !importError && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {fileName} ({(fileSize / 1024).toFixed(1)} KB)
                  </Typography>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField autoFocus label={t('forms.contentTemplate.fields.name')} value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth required />
                <TextField label={t('forms.contentTemplate.fields.slugPrefix')} value={editSlugPrefix} onChange={(e) => setEditSlugPrefix(e.target.value)} fullWidth InputProps={{ sx: { fontFamily: 'monospace' } }} />
                <TextField
                  label={t('forms.contentTemplate.fields.body')}
                  value={editBody}
                  fullWidth
                  multiline
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' } }}
                />
              </Box>
            )}
            {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          {activeStep === 1 && (
            <Button onClick={handleBack} disabled={loading}>{t('common.actions.back')}</Button>
          )}

          {activeStep === 1 && method === 'scratch' && (
            <Button variant="contained" onClick={handleScratchSubmit} disabled={!name.trim() || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}

          {activeStep === 1 && method === 'template' && (
            <Button variant="contained" onClick={handleTemplateConfirm} disabled={!selectedTemplate || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}

          {activeStep === 1 && method === 'import' && parsed && (
            <Button variant="contained" onClick={handleImportConfirm} disabled={!editName.trim() || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
