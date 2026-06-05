import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import type { SectionType } from '../../types';

const TAG_MAP: Record<string, string> = {
  Hero: 'forja-hero',
  Features: 'forja-features',
  Cta: 'forja-cta',
  Gallery: 'forja-gallery',
  Testimonials: 'forja-testimonials',
  Pricing: 'forja-pricing',
  Faq: 'forja-faq',
  Contact: 'forja-contact',
  Stats: 'forja-stats',
  Team: 'forja-team',
  Timeline: 'forja-timeline',
  LogoCloud: 'forja-logo-cloud',
  Newsletter: 'forja-newsletter',
  Video: 'forja-video',
  Divider: 'forja-divider',
  Text: 'forja-text-block',
  Portfolio: 'forja-portfolio',
  TagCloud: 'forja-tag-cloud',
  Projects: 'forja-projects',
  Blog: 'forja-blog',
  Legal: 'forja-legal',
};

@Component({ tag: 'forja-section-renderer', shadow: false })
export class ForjaSectionRenderer {
  @Prop() sectionType!: SectionType;
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() imageUrl?: string;
  @Prop() imageAlt?: string;
  @Prop() buttonText?: string;
  @Prop() buttonHref?: string;
  @Prop() items?: unknown[];
  @Prop() settings?: Record<string, unknown>;

  render() {
    const tag = TAG_MAP[this.sectionType];

    if (!tag) {
      return (
        <section class="forja-custom">
          {this.sectionTitle && <h2 class="forja-custom__title">{this.sectionTitle}</h2>}
          {this.text && <div class="forja-custom__text" innerHTML={sanitizeHtml(this.text)} />}
          <slot />
        </section>
      );
    }

    const Tag = tag;
    return (
      <Tag
        sectionTitle={this.sectionTitle}
        text={this.text}
        imageUrl={this.imageUrl}
        imageAlt={this.imageAlt}
        buttonText={this.buttonText}
        buttonHref={this.buttonHref}
        items={this.items}
      >
        <slot />
      </Tag>
    );
  }
}
