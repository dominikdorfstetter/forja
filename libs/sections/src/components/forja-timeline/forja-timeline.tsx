import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { TimelineEvent } from '../../types';

@Component({ tag: 'forja-timeline', shadow: false })
export class ForjaTimeline {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() events?: TimelineEvent[];
  @Prop() layout?: string = 'vertical';
  @Prop() showDates?: boolean = true;

  render() {
    const hasEvents = this.events && this.events.length > 0;
    const classes = ['forja-timeline', `forja-timeline--${this.layout}`].join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Timeline')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-timeline__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-timeline__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasEvents ? (
          <ol class="forja-timeline__list">
            {this.events!.map(event => (
              <li class="forja-timeline__item">
                {this.showDates && event.date && (
                  <time class="forja-timeline__date">{event.date}</time>
                )}
                <h3 class="forja-timeline__event-title">{event.title}</h3>
                {event.text && <div class="forja-timeline__event-text" innerHTML={sanitizeHtml(event.text)} />}
              </li>
            ))}
          </ol>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
