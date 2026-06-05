import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import { type LegalDocType, LEGAL_DOC_TYPE_LABELS } from '../../types';

/**
 * Renders a legal document (Privacy Policy, Terms of Service, etc.)
 * with toggleable metadata sections. Body content is expected as
 * pre-rendered HTML (markdown → HTML conversion happens upstream).
 */
@Component({ tag: 'forja-legal', shadow: false })
export class ForjaLegal {
  /** Document title (e.g. "Privacy Policy"). */
  @Prop() sectionTitle?: string;
  /** Introductory summary text. Supports HTML. */
  @Prop() intro?: string;
  /** Full document body. Supports HTML (pre-rendered markdown). */
  @Prop() body?: string;

  // ── Metadata props ──────────────────────────────────────
  /** Legal document type identifier. Controls the type badge. */
  @Prop() documentType?: LegalDocType;
  /** Document version number (e.g. 1, 2, 3). */
  @Prop() version?: number;
  /** ISO 8601 date string for when the document was created. */
  @Prop() createdAt?: string;
  /** ISO 8601 date string for when the document was last updated. */
  @Prop() updatedAt?: string;
  /** ISO 8601 date string for when the document becomes effective. */
  @Prop() effectiveDate?: string;

  // ── Visibility toggles ─────────────────────────────────
  /** Show the document type badge. Default: true. */
  @Prop() showDocumentType?: boolean = true;
  /** Show the version number. Default: true. */
  @Prop() showVersion?: boolean = true;
  /** Show the effective / updated date. Default: true. */
  @Prop() showDates?: boolean = true;
  /** Show the introductory summary above the body. Default: true. */
  @Prop() showIntro?: boolean = true;

  private formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  private hasMetadata(): boolean {
    return (
      (this.showDocumentType! && !!this.documentType) ||
      (this.showVersion! && this.version != null) ||
      (this.showDates! && !!(this.effectiveDate || this.updatedAt || this.createdAt))
    );
  }

  render() {
    const typeLabel = this.documentType
      ? LEGAL_DOC_TYPE_LABELS[this.documentType] || this.documentType
      : undefined;

    const displayDate = this.effectiveDate || this.updatedAt || this.createdAt;

    return (
      <article class="forja-legal" aria-label={sectionLabel(this.sectionTitle, 'Legal document')}>
        <header class="forja-legal__header">
          {this.sectionTitle && <h1 class="forja-legal__title">{this.sectionTitle}</h1>}

          {this.hasMetadata() && (
            <div class="forja-legal__meta">
              {this.showDocumentType! && typeLabel && (
                <span class="forja-legal__type">{typeLabel}</span>
              )}
              {this.showVersion! && this.version != null && (
                <span class="forja-legal__version">
                  Version {this.version}
                </span>
              )}
              {this.showDates! && displayDate && (
                <time class="forja-legal__date" dateTime={displayDate}>
                  {this.effectiveDate ? 'Effective ' : 'Updated '}
                  {this.formatDate(displayDate)}
                </time>
              )}
            </div>
          )}
        </header>

        {this.showIntro! && this.intro && (
          <div class="forja-legal__intro" innerHTML={sanitizeHtml(this.intro)} />
        )}

        {this.body ? (
          <div class="forja-legal__body" innerHTML={sanitizeHtml(this.body)} />
        ) : (
          <div class="forja-legal__body"><slot /></div>
        )}
      </article>
    );
  }
}
