import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { TestimonialItem } from '../../types';

@Component({ tag: 'forja-testimonials', shadow: false })
export class ForjaTestimonials {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: TestimonialItem[];
  @Prop() columns?: number;

  render() {
    const hasItems = this.items && this.items.length > 0;

    return (
      <section class="forja-testimonials" aria-label={sectionLabel(this.sectionTitle, 'Testimonials')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-testimonials__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-testimonials__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasItems ? (
          <div class="forja-testimonials__list" role="list" data-columns={this.columns}>
            {this.items!.map(item => (
              <blockquote class="forja-testimonials__item" role="listitem">
                <p class="forja-testimonials__quote">{item.quote}</p>
                <footer class="forja-testimonials__attribution">
                  {item.avatarUrl && (
                    <img
                      src={item.avatarUrl}
                      alt=""
                      class="forja-testimonials__avatar"
                      loading="lazy"
                    />
                  )}
                  <cite class="forja-testimonials__author">
                    <span class="forja-testimonials__name">{item.author}</span>
                    {item.role && <span class="forja-testimonials__role">{item.role}</span>}
                  </cite>
                </footer>
              </blockquote>
            ))}
          </div>
        ) : (
          <div class="forja-testimonials__list" role="list" data-columns={this.columns}>
            <slot />
          </div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
