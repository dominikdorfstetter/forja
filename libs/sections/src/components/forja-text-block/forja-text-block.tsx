import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';

@Component({ tag: 'forja-text-block', shadow: false })
export class ForjaTextBlock {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() width?: string = 'default';
  @Prop() alignment?: string = 'left';

  render() {
    const classes = [
      'forja-text',
      `forja-text--${this.width}`,
      `forja-text--${this.alignment}`,
    ].join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Content')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-text__title">{this.sectionTitle}</h2>}
        {this.text ? (
          <div class="forja-text__content" innerHTML={sanitizeHtml(this.text)} />
        ) : (
          <div class="forja-text__content"><slot /></div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
