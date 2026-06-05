import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { GalleryItem } from '../../types';

@Component({ tag: 'forja-gallery', shadow: false })
export class ForjaGallery {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() items?: GalleryItem[];
  @Prop() columns?: number;

  render() {
    const hasItems = this.items && this.items.length > 0;

    return (
      <section class="forja-gallery" aria-label={sectionLabel(this.sectionTitle, 'Gallery')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-gallery__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-gallery__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasItems ? (
          <div class="forja-gallery__grid" role="list" data-columns={this.columns}>
            {this.items!.map(item => (
              <figure class="forja-gallery__item" role="listitem">
                <img
                  src={item.imageUrl}
                  alt={item.alt || ''}
                  class="forja-gallery__image"
                  loading="lazy"
                />
                {item.caption && <figcaption class="forja-gallery__caption">{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <div class="forja-gallery__grid" role="list" data-columns={this.columns}>
            <slot />
          </div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
