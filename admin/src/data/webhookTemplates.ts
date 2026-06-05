export interface WebhookTemplate {
  id: string;
  provider: 'vercel' | 'netlify' | 'cloudflare' | 'custom';
  nameKey: string;
  descriptionKey: string;
  urlPlaceholder: string;
  urlPattern: RegExp;
  defaultEvents: string[];
  defaultDescription: string;
  defaultDebounceSeconds: number;
}

export const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: 'vercel',
    provider: 'vercel',
    nameKey: 'webhooks.templates.vercel',
    descriptionKey: 'webhooks.templates.vercelDesc',
    urlPlaceholder: 'https://api.vercel.app/v1/integrations/deploy/prj_...',
    urlPattern: /^https:\/\/api\.vercel\.app\/v1\/integrations\/deploy\/.+/,
    defaultEvents: ['blog.updated', 'blog.deleted', 'blog.published', 'page.updated', 'page.deleted', 'page.published', 'navigation.updated', 'navigation.deleted', 'legal.updated', 'legal.published'],
    defaultDescription: 'Vercel deploy hook',
    defaultDebounceSeconds: 30,
  },
  {
    id: 'netlify',
    provider: 'netlify',
    nameKey: 'webhooks.templates.netlify',
    descriptionKey: 'webhooks.templates.netlifyDesc',
    urlPlaceholder: 'https://api.netlify.com/build_hooks/...',
    urlPattern: /^https:\/\/api\.netlify\.com\/build_hooks\/.+/,
    defaultEvents: ['blog.updated', 'blog.deleted', 'blog.published', 'page.updated', 'page.deleted', 'page.published', 'navigation.updated', 'navigation.deleted', 'legal.updated', 'legal.published'],
    defaultDescription: 'Netlify build hook',
    defaultDebounceSeconds: 30,
  },
  {
    id: 'cloudflare',
    provider: 'cloudflare',
    nameKey: 'webhooks.templates.cloudflare',
    descriptionKey: 'webhooks.templates.cloudflareDesc',
    urlPlaceholder: 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...',
    urlPattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/pages\/webhooks\/deploy_hooks\/.+/,
    defaultEvents: ['blog.updated', 'blog.deleted', 'blog.published', 'page.updated', 'page.deleted', 'page.published', 'navigation.updated', 'navigation.deleted', 'legal.updated', 'legal.published'],
    defaultDescription: 'Cloudflare Pages deploy hook',
    defaultDebounceSeconds: 30,
  },
];

/** Detect which template (if any) matches a webhook URL */
export function detectTemplate(url: string): WebhookTemplate | undefined {
  return WEBHOOK_TEMPLATES.find((t) => t.urlPattern.test(url));
}
