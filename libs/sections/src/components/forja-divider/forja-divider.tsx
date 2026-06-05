import { Component, Prop, h } from '@stencil/core';

@Component({ tag: 'forja-divider', shadow: false })
export class ForjaDivider {
  @Prop() dividerStyle?: string = 'line';
  @Prop() label?: string;

  render() {
    const classes = ['forja-divider', `forja-divider--${this.dividerStyle}`].join(' ');

    if (this.label) {
      return (
        <div class={classes} role="separator" aria-label={this.label}>
          <span class="forja-divider__label">{this.label}</span>
        </div>
      );
    }

    return <hr class={classes} />;
  }
}
