import { describe, it, expect } from 'vitest';
import { blogWizardReducer, initialBlogWizardState, type BlogWizardState } from '../blogWizardState';

const at = (patch: Partial<BlogWizardState>): BlogWizardState => ({ ...initialBlogWizardState, activeStep: 1, ...patch });

describe('blogWizardReducer BACK', () => {
  it('returns from import preview to upload and clears the import error', () => {
    const next = blogWizardReducer(at({ method: 'import', importPhase: 'preview', importError: 'x' }), { type: 'BACK' });
    expect(next).toMatchObject({ activeStep: 1, method: 'import', importPhase: 'upload', importError: null });
  });

  it('steps the AI flow back one phase at a time', () => {
    const fromPost = blogWizardReducer(at({ method: 'ai', aiPhase: 'post' }), { type: 'BACK' });
    expect(fromPost).toMatchObject({ activeStep: 1, aiPhase: 'outline' });
    const fromOutline = blogWizardReducer(fromPost, { type: 'BACK' });
    expect(fromOutline).toMatchObject({ activeStep: 1, aiPhase: 'idea' });
  });

  it('returns to method selection from the first sub-phase of any method', () => {
    for (const state of [
      at({ method: 'ai', aiPhase: 'idea' }),
      at({ method: 'import', importPhase: 'upload' }),
      at({ method: 'scratch' }),
      at({ method: 'template' }),
    ]) {
      expect(blogWizardReducer(state, { type: 'BACK' })).toMatchObject({ activeStep: 0, method: null });
    }
  });
});

describe('blogWizardReducer AI_FIELDS_REGENERATED', () => {
  it('merges only the provided draft fields', () => {
    const next = blogWizardReducer(at({ aiBody: 'old', aiExcerpt: 'keep' }), {
      type: 'AI_FIELDS_REGENERATED',
      fields: { aiBody: 'new' },
    });
    expect(next).toMatchObject({ aiBody: 'new', aiExcerpt: 'keep' });
  });
});
