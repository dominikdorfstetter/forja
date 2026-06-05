import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { FaqItem } from '../../types';

@Component({ tag: 'forja-faq', shadow: false })
export class ForjaFaq {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: FaqItem[];

  render() {
    const hasItems = this.items && this.items.length > 0;

    return (
      <section class="forja-faq" aria-label={sectionLabel(this.sectionTitle, 'Frequently asked questions')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-faq__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-faq__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasItems ? (
          <div class="forja-faq__list">
            {this.items!.map(item => (
              <details class="forja-faq__item">
                <summary class="forja-faq__question">{item.question}</summary>
                <div class="forja-faq__answer" innerHTML={sanitizeHtml(item.answer)} />
              </details>
            ))}
          </div>
        ) : (
          <div class="forja-faq__list"><slot /></div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
