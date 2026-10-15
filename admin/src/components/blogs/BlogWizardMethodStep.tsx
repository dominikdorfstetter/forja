import CreateIcon from '@mui/icons-material/Create';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WizardMethodCards, { type WizardMethodOption } from '@/components/shared/contentWizard/WizardMethodCards';

type CreationMethod = 'scratch' | 'template' | 'import' | 'ai';

interface BlogWizardMethodStepProps {
  method: CreationMethod | null;
  onSelect: (method: CreationMethod) => void;
  aiAvailable: boolean;
}

const AI_OPTION: WizardMethodOption<CreationMethod> = { key: 'ai', icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.ai', descKey: 'blogs.wizard.methods.aiDesc' };

const BASE_OPTIONS: WizardMethodOption<CreationMethod>[] = [
  { key: 'scratch', icon: <CreateIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.scratch', descKey: 'blogs.wizard.methods.scratchDesc' },
  { key: 'template', icon: <DescriptionIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.template', descKey: 'blogs.wizard.methods.templateDesc' },
  { key: 'import', icon: <UploadFileIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.import', descKey: 'blogs.wizard.methods.importDesc' },
];

export default function BlogWizardMethodStep({ method, onSelect, aiAvailable }: BlogWizardMethodStepProps) {
  const options = aiAvailable ? [AI_OPTION, ...BASE_OPTIONS] : BASE_OPTIONS;
  return <WizardMethodCards options={options} selected={method} onSelect={onSelect} columns={2} />;
}
