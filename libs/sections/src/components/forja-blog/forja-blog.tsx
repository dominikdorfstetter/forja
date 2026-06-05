import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { BlogPostItem } from '../../types';

@Component({ tag: 'forja-blog', shadow: false })
export class ForjaBlog {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() posts?: BlogPostItem[];
  @Prop() columns?: number;
  @Prop() buttonText?: string;
  @Prop() buttonHref?: string;

  render() {
    const hasPosts = this.posts && this.posts.length > 0;

    return (
      <section class="forja-blog" aria-label={sectionLabel(this.sectionTitle, 'Blog')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-blog__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-blog__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasPosts ? (
          <div class="forja-blog__grid" role="list" data-columns={this.columns}>
            {this.posts!.map(post => (
              <article class="forja-blog__card" role="listitem">
                {post.imageUrl && (
                  <a href={post.href} class="forja-blog__image-link">
                    <img src={post.imageUrl} alt="" class="forja-blog__image" loading="lazy" />
                  </a>
                )}
                <div class="forja-blog__content">
                  {(post.date || post.author) && (
                    <div class="forja-blog__meta">
                      {post.date && <time class="forja-blog__date">{post.date}</time>}
                      {post.author && <span class="forja-blog__author">{post.author}</span>}
                    </div>
                  )}
                  <h3 class="forja-blog__post-title">
                    {post.href ? (
                      <a href={post.href} class="forja-blog__link">{post.title}</a>
                    ) : (
                      post.title
                    )}
                  </h3>
                  {post.excerpt && (
                    <div class="forja-blog__excerpt" innerHTML={sanitizeHtml(post.excerpt)} />
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <slot />
        )}
        {this.buttonText && this.buttonHref && (
          <div class="forja-blog__footer">
            <a href={this.buttonHref} class="forja-blog__cta">{this.buttonText}</a>
          </div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
