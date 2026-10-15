import type { CreateContentTemplateRequest } from '@/types/api';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';
import type { TemplateWizardState } from './templateWizardState';

export type TemplateSubmission = Omit<CreateContentTemplateRequest, 'site_id'>;

/** The Create button shows on the details step, and for imports only once a file is parsed. */
export function hasTemplateSubmitAction(state: TemplateWizardState): boolean {
  return state.activeStep === 1 && state.method !== null && (state.method !== 'import' || !!state.parsed);
}

export function isTemplateSubmittable(state: TemplateWizardState): boolean {
  switch (state.method) {
    case 'scratch':
      return !!state.name.trim();
    case 'template':
      return !!state.selectedTemplate;
    case 'import':
      return !!state.editName.trim();
    default:
      return false;
  }
}

function scratchSubmission(state: TemplateWizardState): TemplateSubmission {
  return {
    name: state.name.trim(),
    slug_prefix: state.slugPrefix || 'post',
    body: state.body || undefined,
    icon: 'Article',
    is_featured: false,
    allow_comments: true,
  };
}

function builtinSubmission(tpl: BlogTemplate, t: (key: string) => string): TemplateSubmission {
  return {
    name: t(tpl.nameKey),
    description: t(tpl.descriptionKey),
    icon: tpl.icon,
    slug_prefix: tpl.defaults.slug,
    is_featured: tpl.defaults.is_featured,
    allow_comments: tpl.defaults.allow_comments,
    title: tpl.content.title,
    subtitle: tpl.content.subtitle,
    excerpt: tpl.content.excerpt,
    body: tpl.content.body,
    meta_title: tpl.content.meta_title,
    meta_description: tpl.content.meta_description,
  };
}

function importSubmission(state: TemplateWizardState, parsed: MarkdownParseResult): TemplateSubmission {
  return {
    name: state.editName.trim(),
    slug_prefix: state.editSlugPrefix || 'post',
    body: state.editBody,
    title: parsed.title,
    excerpt: parsed.excerpt,
    meta_title: parsed.meta_title,
    icon: 'Article',
    is_featured: false,
    allow_comments: true,
  };
}

/** Request payload for the chosen method, or null when the step isn't complete. */
export function buildTemplateSubmission(state: TemplateWizardState, t: (key: string) => string): TemplateSubmission | null {
  switch (state.method) {
    case 'scratch':
      return state.name.trim() ? scratchSubmission(state) : null;
    case 'template': {
      const tpl = blogTemplates.find((bt) => bt.id === state.selectedTemplate);
      return tpl ? builtinSubmission(tpl, t) : null;
    }
    case 'import':
      return state.parsed && state.editName.trim() ? importSubmission(state, state.parsed) : null;
    default:
      return null;
  }
}
