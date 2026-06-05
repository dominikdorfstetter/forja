import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { TeamMember } from '../../types';

@Component({ tag: 'forja-team', shadow: false })
export class ForjaTeam {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() members?: TeamMember[];
  @Prop() columns?: number;
  @Prop() showRole?: boolean = true;
  @Prop() showBio?: boolean = true;

  render() {
    const hasMembers = this.members && this.members.length > 0;

    return (
      <section class="forja-team" aria-label={sectionLabel(this.sectionTitle, 'Team')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-team__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-team__text" innerHTML={sanitizeHtml(this.text)} />}
        {hasMembers ? (
          <ul class="forja-team__grid" role="list" data-columns={this.columns}>
            {this.members!.map(member => (
              <li class="forja-team__member">
                {member.imageUrl && (
                  <figure class="forja-team__photo">
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      class="forja-team__image"
                      loading="lazy"
                    />
                  </figure>
                )}
                <h3 class="forja-team__name">{member.name}</h3>
                {this.showRole && member.role && <p class="forja-team__role">{member.role}</p>}
                {this.showBio && member.bio && <p class="forja-team__bio">{member.bio}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <slot />
        )}
        <slot name="after" />
      </section>
    );
  }
}
