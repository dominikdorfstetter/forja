import { Component, Prop, State, Event, EventEmitter, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel, sectionId } from '../../utils/a11y';
import { altchaSolved, renderAltchaWidget } from '../../utils/altcha';
import type { ContactField } from '../../types';

@Component({ tag: 'forja-contact', shadow: false })
export class ForjaContact {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() buttonText?: string;
  @Prop() buttonHref?: string;
  @Prop() fields?: ContactField[];
  @Prop() formAction?: string;

  /**
   * Bot-protection requirement for this form (#773). When `'mandatory'`, a
   * self-hosted ALTCHA widget is rendered and submission is blocked until the
   * visitor's browser has solved the proof-of-work. The open-source
   * `<altcha-widget>` element must be registered by the host page (e.g.
   * `import 'altcha'`) — no Sentinel/paid features are used.
   */
  @Prop() botProtection: 'none' | 'mandatory' = 'none';

  /**
   * Endpoint the ALTCHA widget fetches a fresh challenge from — typically the
   * SDK's `/public/forms/{slug}/altcha-challenge`. The widget injects the
   * solved payload into the form as a hidden `altcha` field, which is emitted
   * with the submission for the consumer to forward as `botProtectionToken`.
   */
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
    // Block submission until the ALTCHA widget has injected a solved hidden
    // `altcha` input. Checks the DOM directly (not FormData) so the gate is
    // independent of the form-serialization step.
    if (this.requiresAltcha && !altchaSolved(form)) {
      this.botProtectionUnsolved = true;
      return;
    }
    this.botProtectionUnsolved = false;
    this.forjaSubmit.emit(new FormData(form));
  };

  render() {
    const hasFields = this.fields && this.fields.length > 0;

    return (
      <section class="forja-contact" aria-label={sectionLabel(this.sectionTitle, 'Contact')}>
        <slot name="before" />
        <div class="forja-contact__content">
          {this.sectionTitle && <h2 class="forja-contact__title">{this.sectionTitle}</h2>}
          {this.text && <div class="forja-contact__text" innerHTML={sanitizeHtml(this.text)} />}
          {this.buttonText && this.buttonHref && (
            <a href={this.buttonHref} class="forja-contact__cta">{this.buttonText}</a>
          )}
        </div>
        {hasFields ? (
          <form
            class="forja-contact__form"
            action={this.formAction}
            method={this.formAction ? 'post' : undefined}
            onSubmit={this.handleSubmit}
          >
            {this.fields!.map(field => {
              const fieldId = sectionId(field.name, 'contact');
              return (
                <div class="forja-contact__field">
                  <label class="forja-contact__label" htmlFor={fieldId}>
                    {field.label}
                    {field.required && <span aria-hidden="true"> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={fieldId}
                      name={field.name}
                      class="forja-contact__input forja-contact__input--textarea"
                      required={field.required}
                      aria-required={field.required ? 'true' : undefined}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      id={fieldId}
                      name={field.name}
                      type={field.type}
                      class="forja-contact__input"
                      required={field.required}
                      aria-required={field.required ? 'true' : undefined}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              );
            })}
            {this.requiresAltcha &&
              renderAltchaWidget(this.altchaChallengeUrl, 'forja-contact-altcha')}
            {this.botProtectionUnsolved && (
              <p class="forja-contact__error" role="alert" data-testid="forja-contact-altcha-error">
                Please complete the verification before submitting.
              </p>
            )}
            <button type="submit" class="forja-contact__submit">
              {this.buttonText || 'Send'}
            </button>
          </form>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
