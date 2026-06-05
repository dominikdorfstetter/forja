import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { LogoItem } from '../../types';

@Component({ tag: 'forja-logo-cloud', shadow: false })
export class ForjaLogoCloud {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() logos?: LogoItem[];
  @Prop() columns?: number;
  @Prop() grayscale?: boolean;

  render() {
    const hasLogos = this.logos && this.logos.length > 0;
    const classes = [
      'forja-logo-cloud',
      this.grayscale && 'forja-logo-cloud--grayscale',
    ].filter(Boolean).join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Partners')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-logo-cloud__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-logo-cloud__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasLogos ? (
          <ul class="forja-logo-cloud__grid" role="list" data-columns={this.columns}>
            {this.logos!.map(logo => (
              <li class="forja-logo-cloud__item">
                {logo.href ? (
                  <a href={logo.href} class="forja-logo-cloud__link" target="_blank" rel="noopener">
                    <img src={logo.imageUrl} alt={logo.alt} class="forja-logo-cloud__image" loading="lazy" />
                  </a>
                ) : (
                  <img src={logo.imageUrl} alt={logo.alt} class="forja-logo-cloud__image" loading="lazy" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
