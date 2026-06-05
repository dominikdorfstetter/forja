import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { PricingTier } from '../../types';

@Component({ tag: 'forja-pricing', shadow: false })
export class ForjaPricing {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() tiers?: PricingTier[];
  @Prop() columns?: number;

  render() {
    const hasTiers = this.tiers && this.tiers.length > 0;

    return (
      <section class="forja-pricing" aria-label={sectionLabel(this.sectionTitle, 'Pricing')}>
        <slot name="before" />
        {(this.sectionTitle || this.text) && (
          <div class="forja-pricing__header">
            {this.sectionTitle && <h2 class="forja-pricing__title">{this.sectionTitle}</h2>}
            {this.text && <div class="forja-pricing__text" innerHTML={sanitizeHtml(this.text)} />}
          </div>
        )}
        {hasTiers ? (
          <div class="forja-pricing__tiers" role="list" data-columns={this.columns}>
            {this.tiers!.map(tier => (
              <div
                class={`forja-pricing__tier${tier.highlighted ? ' forja-pricing__tier--highlighted' : ''}`}
                role="listitem"
              >
                <h3 class="forja-pricing__tier-name">{tier.name}</h3>
                <div class="forja-pricing__price">
                  <span class="forja-pricing__amount">{tier.price}</span>
                  {tier.period && <span class="forja-pricing__period">{tier.period}</span>}
                </div>
                {tier.description && <p class="forja-pricing__description">{tier.description}</p>}
                {tier.features && tier.features.length > 0 && (
                  <ul class="forja-pricing__features">
                    {tier.features.map(feature => (
                      <li class="forja-pricing__feature">{feature}</li>
                    ))}
                  </ul>
                )}
                {tier.buttonText && tier.buttonHref && (
                  <a href={tier.buttonHref} class="forja-pricing__cta">{tier.buttonText}</a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div class="forja-pricing__tiers" role="list" data-columns={this.columns}>
            <slot />
          </div>
        )}
        <slot name="after" />
      </section>
    );
  }
}
