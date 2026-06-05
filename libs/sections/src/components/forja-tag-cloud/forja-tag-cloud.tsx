import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { TagItem } from '../../types';

@Component({ tag: 'forja-tag-cloud', shadow: false })
export class ForjaTagCloud {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() tags?: TagItem[];

  render() {
    const hasTags = this.tags && this.tags.length > 0;

    return (
      <section class="forja-tag-cloud" aria-label={sectionLabel(this.sectionTitle, 'Tags')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-tag-cloud__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-tag-cloud__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasTags ? (
          <nav class="forja-tag-cloud__nav" aria-label="Tags">
            <ul class="forja-tag-cloud__list" role="list">
              {this.tags!.map(tag => (
                <li class="forja-tag-cloud__item">
                  {tag.href ? (
                    <a href={tag.href} class="forja-tag-cloud__tag">
                      <span class="forja-tag-cloud__label">{tag.label}</span>
                      {tag.count != null && (
                        <span class="forja-tag-cloud__count" aria-label={`${tag.count} items`}>
                          ({tag.count})
                        </span>
                      )}
                    </a>
                  ) : (
                    <span class="forja-tag-cloud__tag">
                      <span class="forja-tag-cloud__label">{tag.label}</span>
                      {tag.count != null && (
                        <span class="forja-tag-cloud__count" aria-label={`${tag.count} items`}>
                          ({tag.count})
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
