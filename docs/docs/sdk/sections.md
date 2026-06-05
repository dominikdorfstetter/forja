---
sidebar_position: 2
---

# Sections Library

`@forjacms/sections` provides framework-agnostic Web Components for rendering Forja page sections. Built with [Stencil](https://stenciljs.com/), they work in any framework or plain HTML. Zero CSS -- bring your own styles via BEM class hooks.

## Installation

```bash
# Vanilla / Astro / Vue / Angular
npm install @forjacms/sections

# React (includes typed wrappers)
npm install @forjacms/sections @forjacms/sections-react
```

## Quick Start

### Plain HTML

```html
<script type="module">
  import { defineCustomElements } from '@forjacms/sections/loader';
  defineCustomElements();
</script>

<forja-hero
  section-title="Welcome to Forja"
  text="<p>Build beautiful websites with headless CMS sections.</p>"
  button-text="Get Started"
  button-href="/docs"
></forja-hero>
```

### React

```tsx
import { ForjaHero, ForjaPricing } from '@forjacms/sections-react';

function LandingPage() {
  return (
    <>
      <ForjaHero sectionTitle="Welcome" buttonText="Start" buttonHref="/signup" />
      <ForjaPricing sectionTitle="Plans" tiers={[
        { name: 'Free', price: '$0', features: ['1 site'] },
        { name: 'Pro', price: '$19', period: '/month', highlighted: true, features: ['Unlimited sites'] },
      ]} />
    </>
  );
}
```

### Astro

```astro
---
import '@forjacms/sections/define';
---

<forja-hero section-title="Hello" text="<p>World</p>" />
<forja-features section-title="Features" items={JSON.stringify(features)} />
```

### Vue

Custom Elements work natively in Vue -- no wrapper package needed:

```vue
<script setup>
import { defineCustomElements } from '@forjacms/sections/loader';
defineCustomElements();
</script>

<template>
  <forja-hero section-title="Hello" image-url="/hero.jpg" />
</template>
```

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to your module:

```typescript
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { defineCustomElements } from '@forjacms/sections/loader';

defineCustomElements();

@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
export class AppModule {}
```

## Render a Full Page

Combine with `@forjacms/client` to fetch and render all sections:

```tsx
import { ForjaClient } from '@forjacms/client';
import { ForjaSectionRenderer } from '@forjacms/sections-react';

const client = new ForjaClient({ baseUrl: '...', apiKey: '...', siteId: '...' });
const page = await client.pages.getBySlug('home');

// ForjaSectionRenderer picks the right component by sectionType
{page.sections.map((section) => (
  <ForjaSectionRenderer
    sectionType={section.section_type}
    sectionTitle={section.title}
    text={section.text}
    buttonText={section.button_text}
    buttonHref={section.button_href}
    imageUrl={section.image_url}
    imageAlt={section.image_alt}
    settings={section.settings}
  />
))}
```

## Component Catalog

| Component | Tag | Key Props |
|-----------|-----|-----------|
| Hero | `<forja-hero>` | `sectionTitle`, `text`, `imageUrl`, `buttonText`, `buttonHref`, `fullWidth`, `gradient` |
| Features | `<forja-features>` | `sectionTitle`, `text`, `items: FeatureItem[]`, `columns` |
| CTA | `<forja-cta>` | `sectionTitle`, `text`, `buttonText`, `buttonHref`, `imageUrl` |
| Text Block | `<forja-text-block>` | `sectionTitle`, `text`, `width`, `alignment` |
| Divider | `<forja-divider>` | `dividerStyle`, `label` |
| Gallery | `<forja-gallery>` | `sectionTitle`, `text`, `items: GalleryItem[]`, `columns` |
| Testimonials | `<forja-testimonials>` | `sectionTitle`, `text`, `items: TestimonialItem[]`, `columns` |
| Pricing | `<forja-pricing>` | `sectionTitle`, `text`, `tiers: PricingTier[]`, `columns` |
| Stats | `<forja-stats>` | `sectionTitle`, `text`, `items: StatItem[]`, `columns`, `statsStyle` |
| Team | `<forja-team>` | `sectionTitle`, `text`, `members: TeamMember[]`, `columns`, `showRole`, `showBio` |
| Timeline | `<forja-timeline>` | `sectionTitle`, `text`, `events: TimelineEvent[]`, `layout`, `showDates` |
| Logo Cloud | `<forja-logo-cloud>` | `sectionTitle`, `text`, `logos: LogoItem[]`, `columns`, `grayscale` |
| FAQ | `<forja-faq>` | `sectionTitle`, `text`, `items: FaqItem[]` |
| Contact | `<forja-contact>` | `sectionTitle`, `text`, `fields: ContactField[]`, `formAction` |
| Newsletter | `<forja-newsletter>` | `sectionTitle`, `text`, `buttonText`, `formAction`, `showName` |
| Video | `<forja-video>` | `sectionTitle`, `text`, `videoUrl`, `provider`, `autoplay`, `aspectRatio` |
| Portfolio | `<forja-portfolio>` | `sectionTitle`, `text`, `experiences`, `education`, `skills` |
| Tag Cloud | `<forja-tag-cloud>` | `sectionTitle`, `text`, `tags: TagItem[]` |
| Projects | `<forja-projects>` | `sectionTitle`, `text`, `items: ProjectItem[]`, `columns` |
| Blog | `<forja-blog>` | `sectionTitle`, `text`, `posts: BlogPostItem[]`, `columns`, `buttonText`, `buttonHref` |
| Legal | `<forja-legal>` | `sectionTitle`, `intro`, `body`, `documentType`, `version`, `effectiveDate` |
| Nav | `<forja-nav>` | `siteName`, `homeHref`, `items: NavItem[]`, `locales`, `currentLocale`, `showThemeToggle` |
| Footer | `<forja-footer>` | `siteName`, `homeHref`, `items: NavItem[]`, `socialLinks`, `tagline`, `showRss` |
| Section Renderer | `<forja-section-renderer>` | `sectionType`, plus all common section props |

## Styling

Components ship with **zero CSS** and render in the light DOM (`shadow: false`). Style them using BEM class hooks:

```css
/* Hero section */
.forja-hero { position: relative; }
.forja-hero__image { width: 100%; height: auto; }
.forja-hero__content { padding: 2rem; }
.forja-hero__title { font-size: 2.5rem; }
.forja-hero__cta { display: inline-block; padding: 0.75rem 1.5rem; }

/* Modifier classes */
.forja-hero--full-width { width: 100vw; }
.forja-hero--gradient { background: linear-gradient(...); }

/* Grid components use data-columns for responsive layouts */
.forja-features__grid[data-columns="3"] {
  grid-template-columns: repeat(3, 1fr);
}
```

## Structured Data Props

Components that accept arrays/objects handle both JSON strings (HTML attributes) and typed objects (framework props):

```html
<!-- HTML: JSON string -->
<forja-pricing tiers='[{"name":"Free","price":"$0"}]'></forja-pricing>
```

```tsx
// React: typed prop
<ForjaPricing tiers={[{ name: 'Free', price: '$0' }]} />
```

## Events

Form components emit custom events:

| Component | Event | Payload |
|-----------|-------|---------|
| `<forja-contact>` | `forjaSubmit` | `FormData` |
| `<forja-newsletter>` | `forjaSubmit` | `FormData` |

```tsx
// React
<ForjaContact onForjaSubmit={(e) => console.log(e.detail)} />
```

```javascript
// Vanilla
document.querySelector('forja-contact')
  .addEventListener('forjaSubmit', (e) => console.log(e.detail));
```

## Accessibility

All components follow WCAG 2.1 AA patterns:

- Semantic HTML: `<section>`, `<article>`, `<figure>`, `<blockquote>`, `<details>`, `<dl>`, `<time>`
- `aria-label` on every section (title or descriptive fallback)
- `aria-hidden="true"` on decorative elements
- `aria-required` on required form fields
- Native `<details>/<summary>` for FAQ accordion (no JS needed)
- Keyboard navigation via native HTML semantics
