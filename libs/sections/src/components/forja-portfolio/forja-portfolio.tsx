import { Component, Prop, h } from '@stencil/core';
import { sanitizeHtml } from '../../utils/sanitize';
import { sectionLabel } from '../../utils/a11y';
import type { PortfolioExperience, EducationItem, SkillItem } from '../../types';

@Component({ tag: 'forja-portfolio', shadow: false })
export class ForjaPortfolio {
  @Prop() sectionTitle?: string;
  @Prop() text?: string;
  @Prop() experiences?: PortfolioExperience[];
  @Prop() education?: EducationItem[];
  @Prop() skills?: SkillItem[];
  @Prop() columns?: number;

  private renderExperiences() {
    if (!this.experiences || this.experiences.length === 0) return null;
    return (
      <div class="forja-portfolio__experiences">
        <h3 class="forja-portfolio__group-title">Experience</h3>
        <ol class="forja-portfolio__list">
          {this.experiences.map(exp => (
            <li class="forja-portfolio__entry">
              <article class="forja-portfolio__card">
                {exp.logoUrl && (
                  <img src={exp.logoUrl} alt="" class="forja-portfolio__logo" loading="lazy" />
                )}
                <div class="forja-portfolio__details">
                  <h4 class="forja-portfolio__role">{exp.role}</h4>
                  <p class="forja-portfolio__company">{exp.company}</p>
                  {exp.period && <time class="forja-portfolio__period">{exp.period}</time>}
                  {exp.description && (
                    <div class="forja-portfolio__description" innerHTML={sanitizeHtml(exp.description)} />
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  private renderEducation() {
    if (!this.education || this.education.length === 0) return null;
    return (
      <div class="forja-portfolio__education">
        <h3 class="forja-portfolio__group-title">Education</h3>
        <ol class="forja-portfolio__list">
          {this.education.map(edu => (
            <li class="forja-portfolio__entry">
              <article class="forja-portfolio__card">
                <div class="forja-portfolio__details">
                  <h4 class="forja-portfolio__role">{edu.degree}</h4>
                  <p class="forja-portfolio__company">{edu.institution}</p>
                  {edu.period && <time class="forja-portfolio__period">{edu.period}</time>}
                  {edu.description && (
                    <div class="forja-portfolio__description" innerHTML={sanitizeHtml(edu.description)} />
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  private renderSkills() {
    if (!this.skills || this.skills.length === 0) return null;

    const grouped = this.skills.reduce<Record<string, SkillItem[]>>((acc, skill) => {
      const cat = skill.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    }, {});

    return (
      <div class="forja-portfolio__skills">
        <h3 class="forja-portfolio__group-title">Skills</h3>
        {Object.entries(grouped).map(([category, items]) => (
          <div class="forja-portfolio__skill-group">
            {Object.keys(grouped).length > 1 && (
              <h4 class="forja-portfolio__skill-category">{category}</h4>
            )}
            <ul class="forja-portfolio__skill-list" data-columns={this.columns}>
              {items.map(skill => (
                <li class="forja-portfolio__skill">{skill.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  render() {
    return (
      <section class="forja-portfolio" aria-label={sectionLabel(this.sectionTitle, 'Portfolio')}>
        <slot name="before" />
        {this.sectionTitle && <h2 class="forja-portfolio__title">{this.sectionTitle}</h2>}
        {this.text && <div class="forja-portfolio__text" innerHTML={sanitizeHtml(this.text)} />}
        {this.renderExperiences()}
        {this.renderEducation()}
        {this.renderSkills()}
        <slot name="after" />
      </section>
    );
  }
}
