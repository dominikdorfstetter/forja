import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-portfolio', () => {
  it('renders experience entries', async () => {
    const experiences = [
      { company: 'Acme Corp', role: 'Lead Engineer', period: '2020 – 2023', description: '<p>Built things</p>' },
      { company: 'Globex', role: 'Developer', logoUrl: '/globex.png' },
    ];
    const { root } = await render(<forja-portfolio sectionTitle="My CV" experiences={experiences} />);
    expect(root.querySelector('.forja-portfolio__title')!.textContent).toBe('My CV');

    const entries = root.querySelectorAll('.forja-portfolio__entry');
    expect(entries.length).toBe(2);
    expect(entries[0].querySelector('.forja-portfolio__role')!.textContent).toBe('Lead Engineer');
    expect(entries[0].querySelector('.forja-portfolio__company')!.textContent).toBe('Acme Corp');
    expect(entries[0].querySelector('time')!.textContent).toBe('2020 – 2023');
    expect(entries[1].querySelector('.forja-portfolio__logo')).not.toBeNull();
  });

  it('renders education entries', async () => {
    const education = [
      { institution: 'MIT', degree: 'MSc Computer Science', period: '2016 – 2018' },
    ];
    const { root } = await render(<forja-portfolio education={education} />);
    const edu = root.querySelector('.forja-portfolio__education')!;
    expect(edu).not.toBeNull();
    expect(edu.querySelector('.forja-portfolio__role')!.textContent).toBe('MSc Computer Science');
    expect(edu.querySelector('.forja-portfolio__company')!.textContent).toBe('MIT');
  });

  it('renders skills grouped by category', async () => {
    const skills = [
      { name: 'TypeScript', category: 'Languages' },
      { name: 'Rust', category: 'Languages' },
      { name: 'Leadership', category: 'Soft Skills' },
    ];
    const { root } = await render(<forja-portfolio skills={skills} />);
    const groups = root.querySelectorAll('.forja-portfolio__skill-group');
    expect(groups.length).toBe(2);
    const skillItems = root.querySelectorAll('.forja-portfolio__skill');
    expect(skillItems.length).toBe(3);
  });

  it('uses fallback aria-label', async () => {
    const { root } = await render(<forja-portfolio />);
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Portfolio');
  });
});
