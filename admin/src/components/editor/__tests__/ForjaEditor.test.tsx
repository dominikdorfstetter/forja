import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import ForjaEditor from '../ForjaEditor';

// Mock Tiptap to avoid ProseMirror DOM issues in jsdom
vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
    commands: { setContent: vi.fn(), insertImageViaPicker: vi.fn() },
    isActive: () => false,
    can: () => ({ undo: () => false, redo: () => false }),
    getAttributes: () => ({}),
    isDestroyed: false,
    storage: { markdown: { getMarkdown: () => '' } },
    on: vi.fn(),
    off: vi.fn(),
  }),
  EditorContent: ({ editor }: { editor: unknown }) =>
    createElement('div', { 'data-testid': 'editor-content' }, editor ? 'Editor loaded' : null),
  ReactRenderer: vi.fn(),
}));

vi.mock('../SlashCommandMenu', () => ({
  SlashCommands: {},
}));

vi.mock('../ImagePickerExtension', () => ({
  default: { configure: () => ({}) },
}));

vi.mock('@/components/media/MediaPickerDialog', () => ({
  default: () => null,
}));

describe('ForjaEditor', () => {
  it('renders without crashing', () => {
    render(<ForjaEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    render(<ForjaEditor value="# Hello" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Bullet List')).toBeInTheDocument();
    expect(screen.getByLabelText('Image')).toBeInTheDocument();
    expect(screen.getByLabelText('Undo (Ctrl+Z)')).toBeInTheDocument();
  });

  it('displays editor content area', () => {
    render(<ForjaEditor value="# Test" onChange={vi.fn()} />);
    expect(screen.getByText('Editor loaded')).toBeInTheDocument();
  });

  it('renders with custom height', () => {
    const { container } = render(<ForjaEditor value="" onChange={vi.fn()} height={300} />);
    expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument();
  });
});
