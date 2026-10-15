import { useTranslation } from 'react-i18next';
import { blogTemplates } from '@/data/blogTemplates';
import TemplateBrowser from '@/components/shared/contentWizard/TemplateBrowser';

interface TemplateWizardTemplateStepProps {
  selectedTemplate: string | null;
  onSelectTemplate: (id: string) => void;
  templateSearch: string;
  onSearchChange: (value: string) => void;
  templatePage: number;
  onPageChange: (page: number) => void;
}

export default function TemplateWizardTemplateStep({
  selectedTemplate,
  onSelectTemplate,
  templateSearch,
  onSearchChange,
  templatePage,
  onPageChange,
}: TemplateWizardTemplateStepProps) {
  const { t } = useTranslation();

  const templates = blogTemplates.map((tpl) => ({
    id: tpl.id,
    name: t(tpl.nameKey),
    description: t(tpl.descriptionKey),
    icon: tpl.icon,
    bodyPreview: tpl.content.body.trimStart().slice(0, 100),
  }));

  return (
    <TemplateBrowser
      templates={templates}
      selectedTemplate={selectedTemplate}
      onSelectTemplate={onSelectTemplate}
      onClearSelection={() => onSelectTemplate('')}
      templateSearch={templateSearch}
      onSearchChange={onSearchChange}
      templatePage={templatePage}
      onPageChange={onPageChange}
    />
  );
}
