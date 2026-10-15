import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import CreateTemplateWizard from '../CreateTemplateWizard';

function renderWizard(loading = false) {
  const props = { open: true, onClose: vi.fn(), onSubmit: vi.fn(), loading };
  renderWithProviders(<CreateTemplateWizard {...props} />);
  return props;
}

describe('CreateTemplateWizard', () => {
  it('submits a scratch template with trimmed name and default slug prefix', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('From Scratch'));
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText(/Name/), '  My Template  ');
    await user.clear(screen.getByLabelText('Slug Prefix'));
    await user.click(create);

    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'My Template',
      slug_prefix: 'post',
      body: undefined,
      icon: 'Article',
      is_featured: false,
      allow_comments: true,
    });
  });

  it('submits a built-in template', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('From Built-in'));
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    await user.click(screen.getByText('Changelog'));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Changelog',
      slug_prefix: 'changelog',
    }));
  });

  it('clears the selection when searching', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByText('From Built-in'));
    await user.click(screen.getByText('Changelog'));
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();

    await user.type(screen.getByPlaceholderText(/search/i), 'zzz-no-match');
    expect(screen.getByText('No templates match your search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('imports markdown and submits the edited name and slug prefix', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('Import Markdown'));
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();

    const file = new File(['# Release Notes\n\nBody here.'], 'notes.md', { type: 'text/markdown' });
    await user.upload(screen.getByLabelText('Select file'), file);

    const name = await screen.findByLabelText(/Name/);
    expect(name).toHaveValue('Release Notes');
    await user.clear(name);
    await user.type(name, 'Notes');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Notes',
      slug_prefix: 'release-notes',
      title: 'Release Notes',
      icon: 'Article',
    }));
  });

  it('returns to the method step on back', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByText('From Scratch'));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('From Built-in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('shows the saving label while loading', async () => {
    const user = userEvent.setup();
    renderWizard(true);

    await user.click(screen.getByText('From Scratch'));
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  });
});
