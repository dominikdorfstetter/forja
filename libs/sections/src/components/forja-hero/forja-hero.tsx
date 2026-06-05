import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';

@Component({ tag: 'forja-hero', shadow: false })
export class ForjaHero {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() imageUrl?: string;
  @Prop() imageAlt?: string;
  @Prop() buttonText?: string;
  @Prop() buttonHref?: string;
  @Prop() fullWidth?: boolean;
  @Prop() gradient?: boolean;

  render() {
    const classes = [
      'forja-hero',
      this.fullWidth && 'forja-hero--full-width',
      this.gradient && 'forja-hero--gradient',
    ].filter(Boolean).join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Hero')}>
        <slot name="before" />
        {this.imageUrl && (
          <img
            src={this.imageUrl}
            alt={this.imageAlt || ''}
            class="forja-hero__image"
            loading="eager"
          />
        )}
        <div class="forja-hero__content">
          {this.sectionTitle && <h2 class="forja-hero__title">{this.sectionTitle}</h2>}
          {this.text && <div class="forja-hero__text" innerHTML={sanitizeHtml(this.text)} />}
          {this.buttonText && this.buttonHref && (
            <a href={this.buttonHref} class="forja-hero__cta">{this.buttonText}</a>
          )}
        </div>
        <slot name="after" />
      </section>
    );
  }
}
