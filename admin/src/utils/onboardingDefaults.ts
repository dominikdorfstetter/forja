import type { UserType, ContentIntent } from '@/types/api';

interface WizardDefaults {
  modules: {
    blog: boolean;
    pages: boolean;
    cv: boolean;
    legal: boolean;
    documents: boolean;
    ai: boolean;
  };
  workflowMode: 'solo' | 'team';
}

const BASE_MODULES: WizardDefaults['modules'] = {
  blog: false,
  pages: false,
  cv: false,
  legal: false,
  documents: false,
  ai: false,
};

const INTENT_MODULE_MAP: Record<ContentIntent, (keyof WizardDefaults['modules'])[]> = {
  blog: ['blog'],
  portfolio: ['blog', 'pages', 'cv'],
  marketing: ['pages'],
  docs: ['pages'],
  company: ['blog', 'pages'],
};

/**
 * Compute SiteCreationWizard defaults from onboarding survey answers.
 *
 * Agency users get legal + documents by default regardless of intents.
 * Team/agency users default to editorial workflow mode.
 */
export function computeWizardDefaults(
  userType: UserType,
  intents: ContentIntent[],
): WizardDefaults {
  const modules = { ...BASE_MODULES };

  // Enable modules based on selected intents
  for (const intent of intents) {
    const keys = INTENT_MODULE_MAP[intent];
    for (const key of keys) {
      modules[key] = true;
    }
  }

  // Agency users always get legal + documents
  if (userType === 'agency') {
    modules.blog = true;
    modules.pages = true;
    modules.legal = true;
    modules.documents = true;
  }

  // Default workflow: solo for solo users, team for team/agency
  const workflowMode = userType === 'solo' ? 'solo' : 'team';

  return { modules, workflowMode };
}
