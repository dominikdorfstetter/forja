import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

const features = [
  {
    title: 'Multi-Site CMS',
    description:
      'Manage multiple websites from a single backend. Each site has its own content, navigation, media, and settings.',
  },
  {
    title: 'Built with Rust',
    description:
      'High-performance REST API powered by Rocket 0.5 and SQLx. Type-safe, memory-safe, and fast.',
  },
  {
    title: 'React Admin Dashboard',
    description:
      'Modern admin UI built with React, MUI, and React Query. Drag-and-drop, command palette, dark mode.',
  },
  {
    title: 'Internationalization',
    description:
      'Full i18n support with per-locale content, configurable locales per site, and RTL text direction.',
  },
  {
    title: 'Dual Authentication',
    description:
      'API key authentication for integrations and Clerk JWT for the admin dashboard. Role-based access control.',
  },
  {
    title: 'Developer Friendly',
    description:
      'OpenAPI/Swagger docs, comprehensive REST API, pluggable frontend templates, and Docker-based dev environment.',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary')}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div>
          <Link
            className="button button--secondary button--lg"
            to="docs/getting-started/prerequisites">
            Get Started
          </Link>
          {' '}
          <Link
            className="button button--outline button--secondary button--lg"
            to="docs/api/overview">
            API Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageFeatures() {
  return (
    <section className="features">
      <div className="feature-grid">
        {features.map((feature, idx) => (
          <div key={idx} className="feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
