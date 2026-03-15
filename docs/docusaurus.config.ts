import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const version = process.env.FORJA_VERSION || 'dev';

const config: Config = {
  title: 'Forja',
  tagline: 'Forge your content — a multi-site CMS built with Rust and React',
  favicon: 'img/logo.svg',

  url: 'https://forja-docs.dorfstetter.at',
  baseUrl: '/',

  organizationName: 'dominikdorfstetter',
  projectName: 'forja',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/dominikdorfstetter/forja/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Forja',
      logo: {
        alt: 'Forja Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'html',
          position: 'right',
          value: `<span style="font-size:0.8rem;color:var(--ifm-color-emphasis-600)">${version}</span>`,
        },
        {
          href: 'https://github.com/dominikdorfstetter/forja',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: 'docs/getting-started/prerequisites'},
            {label: 'API Reference', to: 'docs/api/overview'},
            {label: 'Admin Guide', to: 'docs/admin-guide/overview'},
          ],
        },
        {
          title: 'Developer',
          items: [
            {label: 'Architecture', to: 'docs/architecture/overview'},
            {label: 'Contributing', to: 'docs/developer/contributing'},
            {label: 'Deployment', to: 'docs/deployment/docker'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/dominikdorfstetter/forja'},
            {label: 'Changelog', to: 'docs/changelog'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Dominik Dorfstetter. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['rust', 'toml', 'bash', 'sql', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
