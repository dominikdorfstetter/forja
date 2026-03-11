import DescriptionIcon from '@mui/icons-material/Description';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ViewListIcon from '@mui/icons-material/ViewList';
import ExtensionIcon from '@mui/icons-material/Extension';
import type { PageType } from '@/types/api';

interface PageTypeInfo {
  type: PageType;
  icon: React.ReactNode;
  labelKey: string;
  descriptionKey: string;
}

export const PAGE_TYPE_CONFIG: PageTypeInfo[] = [
  { type: 'Static', icon: <DescriptionIcon />, labelKey: 'pages.wizard.types.static', descriptionKey: 'pages.wizard.types.staticDesc' },
  { type: 'Landing', icon: <RocketLaunchIcon />, labelKey: 'pages.wizard.types.landing', descriptionKey: 'pages.wizard.types.landingDesc' },
  { type: 'Contact', icon: <ContactMailIcon />, labelKey: 'pages.wizard.types.contact', descriptionKey: 'pages.wizard.types.contactDesc' },
  { type: 'BlogIndex', icon: <ViewListIcon />, labelKey: 'pages.wizard.types.blogIndex', descriptionKey: 'pages.wizard.types.blogIndexDesc' },
  { type: 'Custom', icon: <ExtensionIcon />, labelKey: 'pages.wizard.types.custom', descriptionKey: 'pages.wizard.types.customDesc' },
];
