import { useRef, useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { common, createLowlight } from 'lowlight';
import 'highlight.js/styles/vs2015.css';

const lowlight = createLowlight(common);

function hastToHtml(node: { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: typeof node[] }): string {
  if (node.type === 'text') {
    return (node.value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  if (node.type === 'element') {
    const attrs = node.properties?.className?.map((c: string) => `class="${c}"`).join(' ') ?? '';
    const tag = node.tagName ?? 'span';
    const children = (node.children ?? []).map(hastToHtml).join('');
    return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
  }
  if (node.type === 'root') {
    return (node.children ?? []).map(hastToHtml).join('');
  }
  return '';
}

interface HighlightedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  language?: string;
  minRows?: number;
  error?: boolean;
  helperText?: string;
  'data-testid'?: string;
}

export default function HighlightedCodeEditor({
  value,
  onChange,
  placeholder = '',
  maxLength,
  language = 'xml',
  minRows = 6,
  error = false,
  helperText,
  'data-testid': testId,
}: HighlightedCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const highlightedHtml = useMemo(() => {
    if (!value) return '';
    try {
      const tree = lowlight.highlight(language, value);
      return hastToHtml(tree as unknown as Parameters<typeof hastToHtml>[0]);
    } catch {
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [value, language]);

  const lineHeight = 1.5;
  const fontSize = '0.85rem';
  const padding = '12px';
  const minHeight = `${minRows * 1.5}em`;

  const sharedStyles = {
    fontFamily: 'monospace',
    fontSize,
    lineHeight,
    padding,
    margin: 0,
    border: 'none',
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    minHeight,
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  // Note: dangerouslySetInnerHTML is safe here because hastToHtml escapes all
  // text node content (&, <, >) and only produces <span class="hljs-*"> wrappers
  // from the lowlight syntax tree -- no raw user input passes through unescaped.
  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'grey.900',
          '&:focus-within': {
            borderColor: error ? 'error.main' : 'primary.main',
            boxShadow: (theme) =>
              `0 0 0 1px ${error ? theme.palette.error.main : theme.palette.primary.main}`,
          },
        }}
      >
        {/* Highlighted underlay — intentional pattern: <pre> with absolute
            positioning renders the highlighted HAST output (trusted, not
            user-controlled) underneath a transparent <textarea> overlay.
            This file is exempt from no-inline-exhaustive-style / no-danger /
            no-outline-none via react-doctor.config.json, because sx/theme
            don't apply to native <pre>/<textarea> and the outline must be
            suppressed so it doesn't draw over the underlay; focus visibility
            is handled by the parent Box's focus-within border. */}
        <pre
          ref={preRef}
          aria-hidden="true"
          style={{
            ...sharedStyles,
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
            color: '#d4d4d4',
            background: 'transparent',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
          className="hljs"
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          maxLength={maxLength}
          spellCheck={false}
          data-testid={testId}
          style={{
            ...sharedStyles,
            position: 'relative',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#d4d4d4',
            outline: 'none',
            resize: 'vertical',
            overflow: 'auto',
            WebkitTextFillColor: 'transparent',
          }}
        />
      </Box>
      {helperText && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ mt: 0.5, ml: 1.5, display: 'block' }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
