import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { ProjectItem } from '../../types';

@Component({ tag: 'forja-projects', shadow: false })
export class ForjaProjects {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: ProjectItem[];
  @Prop() columns?: number;

  render() {
    const hasItems = this.items && this.items.length > 0;

    return (
      <section class="forja-projects" aria-label={sectionLabel(this.sectionTitle, 'Projects')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-projects__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-projects__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasItems ? (
          <div class="forja-projects__grid" role="list" data-columns={this.columns}>
            {this.items!.map(item => (
              <article class="forja-projects__card" role="listitem">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" class="forja-projects__image" loading="lazy" />
                )}
                <div class="forja-projects__content">
                  <div class="forja-projects__header">
                    <h3 class="forja-projects__name">
                      {item.href ? (
                        <a href={item.href} class="forja-projects__link">{item.title}</a>
                      ) : (
                        item.title
                      )}
                    </h3>
                    {item.status && (
                      <span class="forja-projects__status">{item.status}</span>
                    )}
                  </div>
                  {item.description && (
                    <div class="forja-projects__description" innerHTML={sanitizeHtml(item.description)} />
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <ul class="forja-projects__tags">
                      {item.tags.map(tag => (
                        <li class="forja-projects__tag">{tag}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
