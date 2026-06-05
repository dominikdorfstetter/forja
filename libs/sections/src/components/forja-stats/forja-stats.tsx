import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { StatItem } from '../../types';

@Component({ tag: 'forja-stats', shadow: false })
export class ForjaStats {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: StatItem[];
  @Prop() columns?: number;
  @Prop() statsStyle?: string;

  render() {
    const hasItems = this.items && this.items.length > 0;
    const classes = [
      'forja-stats',
      this.statsStyle && `forja-stats--${this.statsStyle}`,
    ].filter(Boolean).join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Statistics')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-stats__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-stats__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasItems ? (
          <dl class="forja-stats__list" data-columns={this.columns}>
            {this.items!.map(item => (
              <div class="forja-stats__item">
                <dd class="forja-stats__value">{item.value}</dd>
                <dt class="forja-stats__label">{item.label}</dt>
              </div>
            ))}
          </dl>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
