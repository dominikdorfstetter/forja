import { describe, it, expect } from 'vitest';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import { initialTemplateWizardState, templateWizardReducer, type TemplateWizardState } from '../templateWizardState';
import { buildTemplateSubmission, hasTemplateSubmitAction, isTemplateSubmittable } from '../templateWizardFlow';

const t = (key: string) => `t:${key}`;
const at = (patch: Partial<TemplateWizardState>): TemplateWizardState => ({ ...initialTemplateWizardState, activeStep: 1, ...patch });
const parsed: MarkdownParseResult = { title: 'Notes', body: 'Body', excerpt: 'Ex', slug: 'notes-1700000000', meta_title: 'Meta' };

describe('templateWizardReducer SET_PARSED', () => {
  it('seeds the edit fields and strips the timestamp suffix from the slug', () => {
    const next = templateWizardReducer(at({ method: 'import' }), { type: 'SET_PARSED', result: parsed });
    expect(next).toMatchObject({ parsed, editName: 'Notes', editSlugPrefix: 'notes', editBody: 'Body' });
  });
});

describe('hasTemplateSubmitAction', () => {
  it('shows Create on the details step, for imports only once parsed', () => {
    expect(hasTemplateSubmitAction(initialTemplateWizardState)).toBe(false);
    expect(hasTemplateSubmitAction(at({ method: 'scratch' }))).toBe(true);
    expect(hasTemplateSubmitAction(at({ method: 'template' }))).toBe(true);
    expect(hasTemplateSubmitAction(at({ method: 'import' }))).toBe(false);
    expect(hasTemplateSubmitAction(at({ method: 'import', parsed }))).toBe(true);
  });
});

describe('isTemplateSubmittable', () => {
  it('requires the method-specific field', () => {
    expect(isTemplateSubmittable(at({ method: 'scratch', name: '  ' }))).toBe(false);
    expect(isTemplateSubmittable(at({ method: 'scratch', name: 'x' }))).toBe(true);
    expect(isTemplateSubmittable(at({ method: 'template' }))).toBe(false);
    expect(isTemplateSubmittable(at({ method: 'template', selectedTemplate: 'tutorial' }))).toBe(true);
    expect(isTemplateSubmittable(at({ method: 'import', editName: 'n' }))).toBe(true);
  });
});

describe('buildTemplateSubmission', () => {
  it('builds a scratch payload with defaults', () => {
    expect(buildTemplateSubmission(at({ method: 'scratch', name: ' A ', slugPrefix: '', body: '' }), t)).toEqual({
      name: 'A', slug_prefix: 'post', body: undefined, icon: 'Article', is_featured: false, allow_comments: true,
    });
    expect(buildTemplateSubmission(at({ method: 'scratch', name: ' ' }), t)).toBeNull();
  });

  it('builds a built-in payload from the selected template', () => {
    expect(buildTemplateSubmission(at({ method: 'template', selectedTemplate: 'tutorial' }), t)).toMatchObject({
      name: 't:templates.tutorial.name',
      slug_prefix: 'tutorial',
      icon: 'School',
    });
    expect(buildTemplateSubmission(at({ method: 'template', selectedTemplate: 'missing' }), t)).toBeNull();
  });

  it('builds an import payload from the parsed file and edits', () => {
    const state = at({ method: 'import', parsed, editName: ' Edited ', editSlugPrefix: '', editBody: 'Body' });
    expect(buildTemplateSubmission(state, t)).toEqual({
      name: 'Edited', slug_prefix: 'post', body: 'Body', title: 'Notes', excerpt: 'Ex', meta_title: 'Meta',
      icon: 'Article', is_featured: false, allow_comments: true,
    });
    expect(buildTemplateSubmission(at({ method: 'import', editName: 'x' }), t)).toBeNull();
  });
});
