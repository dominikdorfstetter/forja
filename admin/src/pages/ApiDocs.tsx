import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import PublicIcon from '@mui/icons-material/Public';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useTranslation } from 'react-i18next';
import { PageHeader, pageTabsSx } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import { useAuth } from '@/store/AuthContext';

const IFRAME_SX = {
  width: '100%',
  height: 'calc(100vh - 260px)',
  border: '1px solid var(--outline-variant)',
  borderRadius: '16px',
  bgcolor: 'var(--surface-container-low)',
  display: 'block',
} as const;

/** Read a CSS custom property from the parent document, with a fallback
 * in case the variable isn't set (light theme, legacy page, etc.). */
function readToken(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/**
 * After a swagger-ui iframe loads, inject a style tag into its
 * same-origin document that:
 *   (1) hides the green Swagger topbar + Explore row so the embedded
 *       docs read as part of the admin, not a third-party widget;
 *   (2) re-tints the whole swagger-ui chrome against the parent's M3
 *       token palette so titles, endpoint paths, tags and the scheme
 *       bar all stay readable in dark mode — the default swagger-ui
 *       stylesheet assumes a light background and rendered low-contrast
 *       body copy on our --surface dark canvas.
 *
 * Fails soft when the frame is cross-origin; the topbar just stays
 * visible and swagger's own colours apply.
 */
function paintSwaggerIframe(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const styleId = 'forja-swagger-paint';
    const existing = doc.getElementById(styleId);
    if (existing) existing.remove();

    const surface = readToken('--surface', '#0e0e11');
    const surfaceLow = readToken('--surface-container-low', '#14141a');
    const surfaceHigh = readToken('--surface-container-high', '#1b1b22');
    const onSurface = readToken('--on-surface', '#e6e6eb');
    const onSurfaceVariant = readToken('--on-surface-variant', '#b7b7c1');
    const outlineVariant = readToken('--outline-variant', '#2a2a33');
    const primary = readToken('--primary', '#b4a5ff');
    const primaryC = readToken('--primary-c', '#1a1630');

    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      .swagger-ui .topbar { display: none !important; }
      html, body,
      #swagger-ui,
      .swagger-container,
      .swagger-ui,
      .swagger-ui > section,
      .swagger-ui .swagger-container,
      .swagger-ui .wrapper,
      .swagger-ui .information-container,
      .swagger-ui section.models,
      .swagger-ui .opblock-tag-section {
        background: ${surface} !important;
        color: ${onSurface} !important;
      }

      .swagger-ui .info .title,
      .swagger-ui .opblock-tag,
      .swagger-ui h1, .swagger-ui h2, .swagger-ui h3, .swagger-ui h4, .swagger-ui h5 {
        color: ${onSurface} !important;
      }
      .swagger-ui .info p,
      .swagger-ui .info li,
      .swagger-ui .opblock-tag small,
      .swagger-ui .opblock-summary-description,
      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui table thead tr td,
      .swagger-ui table thead tr th,
      .swagger-ui .response-col_status,
      .swagger-ui .tab li,
      .swagger-ui label {
        color: ${onSurfaceVariant} !important;
      }

      .swagger-ui .scheme-container {
        background: ${surfaceLow} !important;
        box-shadow: none !important;
        border: 1px solid ${outlineVariant} !important;
        border-radius: 14px !important;
      }
      .swagger-ui .scheme-container .schemes-title,
      .swagger-ui .scheme-container label {
        color: ${onSurface} !important;
      }
      .swagger-ui select,
      .swagger-ui input[type="text"],
      .swagger-ui input[type="email"],
      .swagger-ui input[type="password"],
      .swagger-ui textarea {
        background: ${surfaceHigh} !important;
        color: ${onSurface} !important;
        border: 1px solid ${outlineVariant} !important;
      }

      .swagger-ui .opblock {
        background: ${surfaceLow} !important;
        border: 1px solid ${outlineVariant} !important;
      }
      .swagger-ui .opblock .opblock-summary {
        border-color: ${outlineVariant} !important;
      }
      .swagger-ui .opblock .opblock-summary-path,
      .swagger-ui .opblock .opblock-summary-path a,
      .swagger-ui .opblock .opblock-summary-path__deprecated {
        color: ${onSurface} !important;
      }
      .swagger-ui .opblock-section-header {
        background: ${surfaceHigh} !important;
        box-shadow: none !important;
      }
      .swagger-ui .opblock-section-header > label,
      .swagger-ui .opblock-section-header h4 {
        color: ${onSurface} !important;
      }
      .swagger-ui .opblock-body pre.microlight {
        background: ${surfaceHigh} !important;
        color: ${onSurface} !important;
      }

      .swagger-ui .btn {
        background: ${surfaceHigh} !important;
        color: ${onSurface} !important;
        border: 1px solid ${outlineVariant} !important;
      }
      .swagger-ui .btn.authorize,
      .swagger-ui .btn.execute {
        background: ${primary} !important;
        color: ${primaryC} !important;
        border-color: transparent !important;
      }
      .swagger-ui .btn.authorize svg {
        fill: ${primaryC} !important;
      }

      .swagger-ui a,
      .swagger-ui .info a {
        color: ${primary} !important;
      }

      .swagger-ui .parameter__name,
      .swagger-ui .parameter__type,
      .swagger-ui .response-col_links,
      .swagger-ui .models-control,
      .swagger-ui .model-title,
      .swagger-ui .model-toggle::after,
      .swagger-ui .tab .tablinks {
        color: ${onSurface} !important;
      }
      .swagger-ui .model,
      .swagger-ui section.models .model-container {
        background: ${surfaceLow} !important;
        border-color: ${outlineVariant} !important;
      }
      .swagger-ui table tbody tr td {
        border-color: ${outlineVariant} !important;
        color: ${onSurfaceVariant} !important;
      }
      .swagger-ui .dialog-ux .modal-ux {
        background: ${surface} !important;
        color: ${onSurface} !important;
        border: 1px solid ${outlineVariant} !important;
      }
      .swagger-ui hr {
        border-color: ${outlineVariant} !important;
      }

      /* Icons (collapse arrows, lock, copy, etc.) were inheriting
         swagger's default near-black fill and vanishing on dark bg. */
      .swagger-ui svg,
      .swagger-ui .expand-methods svg,
      .swagger-ui .expand-operation svg,
      .swagger-ui .authorization__btn svg,
      .swagger-ui .opblock-summary-control svg,
      .swagger-ui .model-toggle::after {
        fill: ${onSurfaceVariant} !important;
        color: ${onSurfaceVariant} !important;
      }
      .swagger-ui .arrow {
        fill: ${onSurfaceVariant} !important;
      }

      /* Schemas section — property rows, types, format badges, and
         the collapse bar background all needed explicit colour since
         swagger's default palette sits on a white canvas. */
      .swagger-ui section.models {
        background: ${surfaceLow} !important;
        border: 1px solid ${outlineVariant} !important;
        border-radius: 14px !important;
      }
      .swagger-ui section.models.is-open h4,
      .swagger-ui section.models h4,
      .swagger-ui section.models h4 span,
      .swagger-ui section.models h4 svg,
      .swagger-ui .models-control {
        color: ${onSurface} !important;
        fill: ${onSurface} !important;
      }
      .swagger-ui section.models .model-container {
        background: ${surface} !important;
      }
      .swagger-ui .model-box {
        background: transparent !important;
      }
      .swagger-ui .model .model-title,
      .swagger-ui .model .property .property-name,
      .swagger-ui .model .brace-open,
      .swagger-ui .model .brace-close,
      .swagger-ui .prop-name,
      .swagger-ui .property-row .property-name,
      .swagger-ui .property .primitive,
      .swagger-ui .model .renderedMarkdown p {
        color: ${onSurface} !important;
      }
      .swagger-ui .model .prop-type,
      .swagger-ui .model span.prop-type,
      .swagger-ui .prop-type {
        color: ${primary} !important;
      }
      .swagger-ui .prop-format,
      .swagger-ui .model-deprecated-warning,
      .swagger-ui .model .prop-format {
        background: ${surfaceHigh} !important;
        color: ${onSurfaceVariant} !important;
        border: 1px solid ${outlineVariant} !important;
      }
      .swagger-ui .example,
      .swagger-ui .model .example,
      .swagger-ui .model pre {
        background: ${surfaceHigh} !important;
        color: ${onSurfaceVariant} !important;
      }
      .swagger-ui .model-toggle {
        color: ${onSurfaceVariant} !important;
      }
    `;
    doc.head.appendChild(style);
  } catch {
    // Cross-origin — silently skip; default swagger light theme applies.
  }
}

export default function ApiDocsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(0);
  const consumerRef = useRef<HTMLIFrameElement | null>(null);
  const adminRef = useRef<HTMLIFrameElement | null>(null);

  const activeSpecUrl =
    tab === 0 ? '/api-docs/consumer/openapi.json' : '/api-docs/admin/openapi.json';
  const activeDownloadName =
    tab === 0 ? 'forja-consumer-openapi.json' : 'forja-admin-openapi.json';

  const handleConsumerLoad = useCallback(() => paintSwaggerIframe(consumerRef.current), []);
  const handleAdminLoad = useCallback(() => paintSwaggerIframe(adminRef.current), []);

  /**
   * Re-paint both iframes whenever the parent's token palette changes
   * (theme flavor / accent switches swap the inline <style> that
   * buildTokenCss emits on <html>). Watching childList + characterData
   * on document.head catches the style-tag replacement, and watching
   * the style attribute on <html> catches CSS variables applied
   * directly to :root. On every token mutation we poll
   * var(--primary) — if it moved from the last-seen value, re-inject.
   */
  useEffect(() => {
    const computePrimary = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();

    let lastPrimary = computePrimary();

    const rerunPaint = () => {
      paintSwaggerIframe(consumerRef.current);
      paintSwaggerIframe(adminRef.current);
    };

    const observer = new MutationObserver(() => {
      const next = computePrimary();
      if (next !== lastPrimary) {
        lastPrimary = next;
        rerunPaint();
      }
    });

    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-flavor', 'data-accent'] });

    return () => observer.disconnect();
  }, []);

  return (
    <Box>
      <PageHeader
        icon="api"
        title={t('apiDocs.title')}
        subtitle={t('apiDocs.subtitle')}
        actions={
          <M3Button
            variant="outlined"
            size="md"
            icon="download"
            onClick={() => {
              const link = document.createElement('a');
              link.href = activeSpecUrl;
              link.download = activeDownloadName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            {t('apiDocs.download', 'Download spec')}
          </M3Button>
        }
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={pageTabsSx}
      >
        <Tab
          icon={<PublicIcon fontSize="small" />}
          iconPosition="start"
          label={t('apiDocs.consumerTab', 'Consumer API')}
        />
        {isAdmin && (
          <Tab
            icon={<AdminPanelSettingsIcon fontSize="small" />}
            iconPosition="start"
            label={t('apiDocs.adminTab', 'Admin API')}
          />
        )}
      </Tabs>

      {tab === 0 && (
        <Box
          component="iframe"
          ref={consumerRef}
          src="/api-docs/consumer/"
          onLoad={handleConsumerLoad}
          sx={IFRAME_SX}
          title={t('apiDocs.consumerTab', 'Consumer API')}
        />
      )}

      {tab === 1 && isAdmin && (
        <Box
          component="iframe"
          ref={adminRef}
          src="/api-docs/admin/"
          onLoad={handleAdminLoad}
          sx={IFRAME_SX}
          title={t('apiDocs.adminTab', 'Admin API')}
        />
      )}
    </Box>
  );
}
