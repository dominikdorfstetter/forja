import { describe, it, expect } from 'vitest';
import { initialBlogWizardState, type BlogWizardState } from '../blogWizardState';
import {
  canManageTemplates,
  isPrimaryActionDisabled,
  primaryActionId,
  regeneratedFields,
  wizardDialogWidth,
} from '../blogWizardFlow';

const at = (patch: Partial<BlogWizardState>): BlogWizardState => ({ ...initialBlogWizardState, activeStep: 1, ...patch });
const idle = { isCreating: false, isGenerating: false };

describe('wizardDialogWidth', () => {
  it('widens for template/ai details and for the AI-enabled method grid', () => {
    expect(wizardDialogWidth(at({ method: 'template' }), false)).toBe('md');
    expect(wizardDialogWidth(at({ method: 'ai' }), true)).toBe('md');
    expect(wizardDialogWidth(initialBlogWizardState, true)).toBe('md');
    expect(wizardDialogWidth(initialBlogWizardState, false)).toBe('sm');
    expect(wizardDialogWidth(at({ method: 'scratch' }), true)).toBe('sm');
  });
});

describe('canManageTemplates', () => {
  it('only offers template management to admins on the template step', () => {
    expect(canManageTemplates(at({ method: 'template' }), true)).toBe(true);
    expect(canManageTemplates(at({ method: 'template' }), false)).toBe(false);
    expect(canManageTemplates(at({ method: 'scratch' }), true)).toBe(false);
  });
});

describe('primaryActionId', () => {
  it('has no primary action on the method step', () => {
    expect(primaryActionId(initialBlogWizardState)).toBeNull();
  });

  it('maps each method and sub-phase to its primary action', () => {
    expect(primaryActionId(at({ method: 'scratch' }))).toBe('scratch');
    expect(primaryActionId(at({ method: 'template' }))).toBe('template');
    expect(primaryActionId(at({ method: 'import', importPhase: 'upload' }))).toBeNull();
    expect(primaryActionId(at({ method: 'import', importPhase: 'preview' }))).toBe('import');
    expect(primaryActionId(at({ method: 'ai', aiPhase: 'idea' }))).toBe('aiOutline');
    expect(primaryActionId(at({ method: 'ai', aiPhase: 'outline' }))).toBe('aiPost');
    expect(primaryActionId(at({ method: 'ai', aiPhase: 'post' }))).toBe('aiCreate');
  });
});

describe('isPrimaryActionDisabled', () => {
  it('requires a selected template', () => {
    expect(isPrimaryActionDisabled('template', at({}), idle)).toBe(true);
    expect(isPrimaryActionDisabled('template', at({ selectedTemplate: 'x' }), idle)).toBe(false);
  });

  it('requires a non-blank import title and slug', () => {
    expect(isPrimaryActionDisabled('import', at({ importTitle: ' ', importSlug: 's' }), idle)).toBe(true);
    expect(isPrimaryActionDisabled('import', at({ importTitle: 't', importSlug: 's' }), idle)).toBe(false);
  });

  it('gates AI generation on generating, and AI creation on creating', () => {
    const ready = at({ aiIdea: 'idea', aiTitle: 'T', aiOutline: [{ id: 0, value: 'a' }] });
    expect(isPrimaryActionDisabled('aiOutline', ready, { isCreating: true, isGenerating: false })).toBe(false);
    expect(isPrimaryActionDisabled('aiOutline', ready, { isCreating: false, isGenerating: true })).toBe(true);
    expect(isPrimaryActionDisabled('aiPost', at({ aiTitle: 'T' }), idle)).toBe(true);
    expect(isPrimaryActionDisabled('aiPost', ready, idle)).toBe(false);
    expect(isPrimaryActionDisabled('aiCreate', ready, { isCreating: true, isGenerating: false })).toBe(true);
    expect(isPrimaryActionDisabled('scratch', ready, { isCreating: true, isGenerating: false })).toBe(true);
  });
});

describe('regeneratedFields', () => {
  it('only overwrites the targeted, non-empty fields', () => {
    const result = { body: 'B', excerpt: 'E', meta_title: '', meta_description: 'D' };
    expect(regeneratedFields('all', result)).toEqual({ aiBody: 'B', aiExcerpt: 'E', aiMetaDescription: 'D' });
    expect(regeneratedFields('body', result)).toEqual({ aiBody: 'B' });
    expect(regeneratedFields('seo', result)).toEqual({ aiMetaDescription: 'D' });
    expect(regeneratedFields('excerpt', {})).toEqual({});
  });
});
