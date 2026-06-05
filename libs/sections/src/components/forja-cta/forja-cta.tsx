import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';

@Component({ tag: 'forja-cta', shadow: false })
export class ForjaCta {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() buttonText?: string;
  @Prop() buttonHref?: string;
  @Prop() imageUrl?: string;
  @Prop() imageAlt?: string;

  render() {
    return (
      <section class="forja-cta" aria-label={sectionLabel(this.sectionTitle, 'Call to action')}>
        <slot name="before" />
        {this.imageUrl && (
          <img
            src={this.imageUrl}
            alt={this.imageAlt || ''}
            class="forja-cta__image"
            loading="lazy"
          />
        )}
        <div class="forja-cta__content">
          {this.sectionTitle && <h2 class="forja-cta__title">{this.sectionTitle}</h2>}
          {this.text && <div class="forja-cta__text" innerHTML={sanitizeHtml(this.text)} />}
          {this.buttonText && this.buttonHref && (
            <a href={this.buttonHref} class="forja-cta__button">{this.buttonText}</a>
          )}
        </div>
        <slot name="after" />
      </section>
    );
  }
}
