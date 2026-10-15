import CreateIcon from '@mui/icons-material/Create';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WizardMethodCards, { type WizardMethodOption } from '@/components/shared/contentWizard/WizardMethodCards';

type CreationMethod = 'scratch' | 'template' | 'import';

interface TemplateWizardMethodStepProps {
  method: CreationMethod | null;
  onSelect: (method: CreationMethod) => void;
}

const METHOD_OPTIONS: WizardMethodOption<CreationMethod>[] = [
  { key: 'scratch', icon: <CreateIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.scratch', descKey: 'contentTemplates.wizard.methods.scratchDesc' },
  { key: 'template', icon: <DescriptionIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.template', descKey: 'contentTemplates.wizard.methods.templateDesc' },
  { key: 'import', icon: <UploadFileIcon sx={{ fontSize: 32 }} />, labelKey: 'contentTemplates.wizard.methods.import', descKey: 'contentTemplates.wizard.methods.importDesc' },
];

export default function TemplateWizardMethodStep({ method, onSelect }: TemplateWizardMethodStepProps) {
  return <WizardMethodCards options={METHOD_OPTIONS} selected={method} onSelect={onSelect} columns={3} />;
}
