import { Component, Prop, State, Event, EventEmitter, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel, sectionId } from '../../utils/a11y';
import { altchaSolved, renderAltchaWidget } from '../../utils/altcha';

@Component({ tag: 'forja-newsletter', shadow: false })
export class ForjaNewsletter {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() buttonText?: string = 'Subscribe';
  @Prop() formAction?: string;
  @Prop() showName?: boolean;

  /** Bot-protection requirement (#773). When `'mandatory'`, renders a
   *  self-hosted ALTCHA widget and gates submission until it is solved. */
  @Prop() botProtection: 'none' | 'mandatory' = 'none';
  /** Challenge endpoint the ALTCHA widget fetches from (#770). */
  @Prop() altchaChallengeUrl?: string;

  /** Set when a Mandatory form is submitted before ALTCHA is solved. */
  @State() private botProtectionUnsolved = false;

  @Event() forjaSubmit!: EventEmitter<FormData>;

  private get requiresAltcha(): boolean {
    return this.botProtection === 'mandatory';
  }

  private handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (this.requiresAltcha && !altchaSolved(form)) {
      this.botProtectionUnsolved = true;
      return;
    }
    this.botProtectionUnsolved = false;
    this.forjaSubmit.emit(new FormData(form));
  };

  render() {
    const emailId = sectionId(this.sectionTitle, 'newsletter-email');
    const nameId = sectionId(this.sectionTitle, 'newsletter-name');

    return (
      <section class="forja-newsletter" aria-label={sectionLabel(this.sectionTitle, 'Newsletter')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-newsletter__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-newsletter__text" innerHTML={sanitizeHtml(this.text)} />}
        <form
          class="forja-newsletter__form"
          action={this.formAction}
          method={this.formAction ? 'post' : undefined}
          onSubmit={this.handleSubmit}
        >
          {this.showName && (
            <div class="forja-newsletter__field">
              <label class="forja-newsletter__label" htmlFor={nameId}>Name</label>
              <input
                id={nameId}
                name="name"
                type="text"
                class="forja-newsletter__input"
              />
            </div>
          )}
          <div class="forja-newsletter__field">
            <label class="forja-newsletter__label" htmlFor={emailId}>Email</label>
            <input
              id={emailId}
              name="email"
              type="email"
              class="forja-newsletter__input"
              required
              aria-required="true"
            />
          </div>
          {this.requiresAltcha &&
            renderAltchaWidget(this.altchaChallengeUrl, 'forja-newsletter-altcha')}
          {this.botProtectionUnsolved && (
            <p class="forja-newsletter__error" role="alert" data-testid="forja-newsletter-altcha-error">
              Please complete the verification before submitting.
            </p>
          )}
          <button type="submit" class="forja-newsletter__submit">
            {this.buttonText}
          </button>
        </form>
        <slot name="after" />
      </section>
    );
  }
}
