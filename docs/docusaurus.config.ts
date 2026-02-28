import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'OpenYapper',
  tagline: 'A multi-site CMS platform built with Rust and React',
  favicon: 'img/favicon.ico',

  url: 'https://dominikdorfstetter.github.io',
  baseUrl: '/openyapper/',

  organizationName: 'dominikdorfstetter',
  projectName: 'openyapper',

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
            'https://github.com/dominikdorfstetter/openyapper/tree/main/website/',
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
      title: 'OpenYapper',
      logo: {
        alt: 'OpenYapper Logo',
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
          href: 'https://github.com/dominikdorfstetter/openyapper',
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
            {label: 'GitHub', href: 'https://github.com/dominikdorfstetter/openyapper'},
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
