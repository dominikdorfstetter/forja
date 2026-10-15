import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';
import type { ContentTemplate } from '@/types/api';
import TemplateBrowser from '@/components/shared/contentWizard/TemplateBrowser';

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

interface BlogWizardTemplateStepProps {
  selectedTemplate: string | null;
  onSelectTemplate: (id: string | null) => void;
  templateSearch: string;
  onSearchChange: (value: string) => void;
  templatePage: number;
  onPageChange: (page: number) => void;
  siteTemplates: ContentTemplate[];
  siteTemplatesLoading: boolean;
}

export function buildMergedTemplates(t: (key: string) => string, siteTemplates: ContentTemplate[]): MergedTemplate[] {
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
}

export default function BlogWizardTemplateStep({
  selectedTemplate,
  onSelectTemplate,
  templateSearch,
  onSearchChange,
  templatePage,
  onPageChange,
  siteTemplates,
  siteTemplatesLoading,
}: BlogWizardTemplateStepProps) {
  const { t } = useTranslation();

  return (
    <TemplateBrowser
      templates={buildMergedTemplates(t, siteTemplates)}
      loading={siteTemplatesLoading}
      selectedTemplate={selectedTemplate}
      onSelectTemplate={onSelectTemplate}
      onClearSelection={() => onSelectTemplate(null)}
      templateSearch={templateSearch}
      onSearchChange={onSearchChange}
      templatePage={templatePage}
      onPageChange={onPageChange}
      renderBadge={(template) => (
        <Chip
          label={template.source === 'builtin' ? t('templates.builtIn') : t('templates.custom')}
          size="small"
          variant="outlined"
          color={template.source === 'builtin' ? 'default' : 'secondary'}
          sx={{ fontSize: '0.65rem', height: 20 }}
        />
      )}
    />
  );
}
