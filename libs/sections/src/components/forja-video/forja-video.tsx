import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';

@Component({ tag: 'forja-video', shadow: false })
export class ForjaVideo {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() videoUrl?: string;
  @Prop() provider?: string = 'youtube';
  @Prop() autoplay?: boolean = false;
  @Prop() aspectRatio?: string = '16:9';

  private getAspectClass(): string {
    const ratioMap: Record<string, string> = {
      '16:9': 'forja-video--16-9',
      '4:3': 'forja-video--4-3',
      '1:1': 'forja-video--1-1',
    };
    return ratioMap[this.aspectRatio!] || 'forja-video--16-9';
  }

  private isSelfHosted(): boolean {
    return this.provider === 'self-hosted';
  }

  render() {
    const classes = ['forja-video', this.getAspectClass()].join(' ');

    return (
      <section class={classes} aria-label={sectionLabel(this.sectionTitle, 'Video')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-video__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-video__text" innerHTML={sanitizeHtml(this.text)} />}
        {this.videoUrl && (
          <figure class="forja-video__container">
            {this.isSelfHosted() ? (
              <video
                class="forja-video__player"
                src={this.videoUrl}
                controls
                autoplay={this.autoplay}
              >
                <track kind="captions" />
              </video>
            ) : (
              <iframe
                class="forja-video__embed"
                src={this.autoplay ? `${this.videoUrl}?autoplay=1` : this.videoUrl}
                title={this.sectionTitle || 'Embedded video'}
                allowFullScreen
                loading="lazy"
              />
            )}
          </figure>
        )}
        <slot name="after" />
      </section>
    );
  }
}
