export interface BlogTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: 'School' | 'NewReleases' | 'RateReview' | 'Campaign';
  defaults: {
    slug: string;
    is_featured: boolean;
    allow_comments: boolean;
  };
  content: {
    title: string;
    subtitle: string;
    excerpt: string;
    body: string;
    meta_title: string;
    meta_description: string;
  };
}

export const blogTemplates: BlogTemplate[] = [
  {
    id: 'tutorial',
    nameKey: 'templates.tutorial.name',
    descriptionKey: 'templates.tutorial.description',
    icon: 'School',
    defaults: {
      slug: 'tutorial',
      is_featured: false,
      allow_comments: true,
    },
    content: {
      title: 'How to [Do Something] Step by Step',
      subtitle: 'A practical guide to getting started with [topic]',
      excerpt: 'Learn how to [do something] with this step-by-step tutorial covering prerequisites, implementation, and best practices.',
      body: `## Prerequisites

Before you begin, make sure you have:

- [ ] Requirement one
- [ ] Requirement two
- [ ] Requirement three

## Step 1: Set Up Your Environment

Describe the initial setup here.

\`\`\`bash
# Example command
echo "Hello, world!"
\`\`\`

## Step 2: Implement the Core Logic

Walk through the main implementation.

\`\`\`typescript
// Example code
function main() {
  console.log("Step 2 complete");
}
\`\`\`

## Step 3: Test and Verify

Explain how to verify everything works.

## Conclusion

Summarize what was accomplished and key takeaways.

## Further Reading

- [Link to documentation](#)
- [Link to related tutorial](#)
- [Link to source code](#)
`,
      meta_title: 'How to [Do Something] — Step-by-Step Tutorial',
      meta_description: 'A practical step-by-step tutorial on [topic]. Covers prerequisites, setup, implementation, and testing.',
    },
  },
  {
    id: 'changelog',
    nameKey: 'templates.changelog.name',
    descriptionKey: 'templates.changelog.description',
    icon: 'NewReleases',
    defaults: {
      slug: 'changelog',
      is_featured: false,
      allow_comments: false,
    },
    content: {
      title: 'v1.0.0 Release Notes',
      subtitle: 'What\'s new, improved, and fixed',
      excerpt: 'Release notes for v1.0.0 including new features, bug fixes, and migration instructions.',
      body: `## What's New

A brief summary of this release and its highlights.

## Features

### Feature Name

Description of the new feature and how to use it.

### Another Feature

Description and usage instructions.

## Bug Fixes

- Fixed issue where [describe bug] (#123)
- Resolved [another issue] that caused [symptom] (#456)
- Corrected [edge case] in [component] (#789)

## Breaking Changes

### Change Name

**Before:**
\`\`\`
old behavior or API
\`\`\`

**After:**
\`\`\`
new behavior or API
\`\`\`

## Migration Guide

Steps to upgrade from the previous version:

1. Update your dependencies
2. Run migrations
3. Update configuration for [changed setting]

## Contributors

Thanks to everyone who contributed to this release!
`,
      meta_title: 'v1.0.0 Release Notes',
      meta_description: 'Release notes for v1.0.0 — new features, bug fixes, breaking changes, and migration guide.',
    },
  },
  {
    id: 'review',
    nameKey: 'templates.review.name',
    descriptionKey: 'templates.review.description',
    icon: 'RateReview',
    defaults: {
      slug: 'review',
      is_featured: false,
      allow_comments: true,
    },
    content: {
      title: '[Product/Tool Name] Review: Is It Worth It?',
      subtitle: 'An honest look at [product] after [time period] of use',
      excerpt: 'A detailed review of [product] covering key features, strengths, weaknesses, and whether it\'s the right choice for you.',
      body: `## Overview

Brief introduction to what [product] is and why you're reviewing it. Include context: how long you've used it, what you used it for, and your experience level.

## Key Features

### Feature One

How it works and your experience with it.

### Feature Two

How it works and your experience with it.

### Feature Three

How it works and your experience with it.

## Pros

- **Strength one** — explanation
- **Strength two** — explanation
- **Strength three** — explanation

## Cons

- **Weakness one** — explanation
- **Weakness two** — explanation
- **Weakness three** — explanation

## Verdict

Your overall assessment. Who is this product best suited for? Who should look elsewhere? Is it worth the price/time investment?

**Rating: X/10**
`,
      meta_title: '[Product] Review — Honest Assessment',
      meta_description: 'Detailed review of [product] covering features, pros, cons, and an honest verdict after real-world use.',
    },
  },
  {
    id: 'announcement',
    nameKey: 'templates.announcement.name',
    descriptionKey: 'templates.announcement.description',
    icon: 'Campaign',
    defaults: {
      slug: 'announcement',
      is_featured: true,
      allow_comments: true,
    },
    content: {
      title: 'Announcing [Your News]',
      subtitle: 'What this means for [audience] and what comes next',
      excerpt: 'We\'re excited to announce [news]. Here\'s what it means and what\'s coming next.',
      body: `## The News

Lead with the announcement. What happened? What's launching? Be clear and direct.

## What This Means

Explain the significance. Why should readers care? How does this affect them?

- **For users:** impact description
- **For developers:** impact description
- **For the community:** impact description

## What's Next

Share your roadmap or next steps. What are you working on? When can people expect the next update?

1. **Short-term** — what's happening in the next few weeks
2. **Medium-term** — what's planned for the next quarter
3. **Long-term** — your vision for the future

## Get Started

Clear call to action. How can readers engage with the announcement?

- [Try it now](#)
- [Read the docs](#)
- [Join the discussion](#)
`,
      meta_title: 'Announcing [Your News]',
      meta_description: 'Announcing [news] — what it means, what\'s next, and how to get started.',
    },
  },
];
