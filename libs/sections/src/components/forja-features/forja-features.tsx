import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { FeatureItem } from '../../types';

@Component({ tag: 'forja-features', shadow: false })
export class ForjaFeatures {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: FeatureItem[];
  @Prop() columns?: number;

  render() {
    const hasItems = this.items && this.items.length > 0;

    return (
      <section class="forja-features" aria-label={sectionLabel(this.sectionTitle, 'Features')}>
        <slot name="before" />
        {(this.sectionTitle || this.text) && (
          <div class="forja-features__header">
            {this.sectionTitle && <h2 class="forja-features__title">{this.sectionTitle}</h2>}
            {this.text && <div class="forja-features__text" innerHTML={sanitizeHtml(this.text)} />}
          </div>
        )}
        {hasItems ? (
          <ul class="forja-features__grid" role="list" data-columns={this.columns}>
            {this.items!.map(item => (
              <li class="forja-features__item">
                {item.icon && <span class="forja-features__icon" aria-hidden="true">{item.icon}</span>}
                <h3 class="forja-features__item-title">{item.title}</h3>
                {item.text && <p class="forja-features__item-text">{item.text}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <div class="forja-features__grid" role="list" data-columns={this.columns}>
            <slot />
          </div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
