/**
 * Section types — mirrors @forjacms/client SectionType.
 * Duplicated here to avoid a hard dependency on @forjacms/client.
 */
export type SectionType =
  | 'Hero'
  | 'Features'
  | 'Cta'
  | 'Gallery'
  | 'Testimonials'
  | 'Pricing'
  | 'Faq'
  | 'Contact'
  | 'Custom'
  | 'Stats'
  | 'Team'
  | 'Timeline'
  | 'LogoCloud'
  | 'Newsletter'
  | 'Video'
  | 'Divider'
  | 'Text'
  | 'Portfolio'
  | 'TagCloud'
  | 'Projects'
  | 'Blog'
  | 'Legal';

/** Props common to all section components. */
export interface BaseSectionProps {
  /** Section heading displayed in an <h2>. Also used as the aria-label fallback for the section landmark. */
  title?: string;
  /** Body text rendered below the heading. Supports inline HTML. */
  text?: string;
  /** Label for the primary call-to-action button. Button is hidden when omitted. */
  buttonText?: string;
  /** URL the primary CTA button links to. Button is hidden when omitted. */
  buttonHref?: string;
  /** URL of the section's primary image (hero background, inline illustration, etc.). */
  imageUrl?: string;
  /** Alt text for the section image. Falls back to an empty string for decorative images. */
  imageAlt?: string;
  /** Arbitrary key-value settings bag passed through from the CMS. Interpretation is component-specific. */
  settings?: Record<string, unknown>;
}

/** Props for the SectionRenderer dispatcher. */
export interface SectionRendererProps extends BaseSectionProps {
  /** Discriminator that determines which section component to render. */
  sectionType: SectionType;
}

// ── Structured item types for section content ────────────────

/** A single feature entry displayed in the Features grid. */
export interface FeatureItem {
  /** Feature heading rendered as an <h3>. */
  title: string;
  /** Optional description displayed below the feature title. */
  text?: string;
  /** Icon string (emoji, ligature name, or SVG markup) rendered with aria-hidden="true". */
  icon?: string;
}

/** A single image entry in the Gallery grid, rendered as a <figure>. */
export interface GalleryItem {
  /** URL of the gallery image. Loaded with loading="lazy". */
  imageUrl: string;
  /** Alt text for the image. Falls back to empty string for decorative images. */
  alt?: string;
  /** Optional caption rendered inside a <figcaption>. */
  caption?: string;
}

/** A single testimonial entry rendered as a <blockquote> with <cite>. */
export interface TestimonialItem {
  /** The testimonial text displayed inside the blockquote. */
  quote: string;
  /** Author name rendered inside a <cite> element. */
  author: string;
  /** Author's role or job title, shown below the name. */
  role?: string;
  /** URL of the author's avatar image. Rendered with empty alt (decorative). */
  avatarUrl?: string;
}

/** A pricing plan card rendered in the Pricing section grid. */
export interface PricingTier {
  /** Plan name displayed as the card heading (<h3>). */
  name: string;
  /** Price string (e.g. "$19", "Free"). Displayed prominently. */
  price: string;
  /** Billing period label (e.g. "/month"). Shown next to the price. */
  period?: string;
  /** Short plan description rendered below the price. */
  description?: string;
  /** List of feature bullet points rendered as a <ul>. */
  features?: string[];
  /** When true, applies a visual emphasis modifier class to this tier card. */
  highlighted?: boolean;
  /** CTA button label for this tier. Button is hidden when omitted. */
  buttonText?: string;
  /** CTA button link for this tier. Button is hidden when omitted. */
  buttonHref?: string;
}

/** A single FAQ entry rendered as a <details>/<summary> accordion item. */
export interface FaqItem {
  /** The question text shown in the <summary> toggle. */
  question: string;
  /** The answer content revealed when the item is expanded. Supports HTML. */
  answer: string;
}

/** Configuration for a single form field in the Contact section. */
export interface ContactField {
  /** HTML name attribute for the input. Also used to generate a unique field id. */
  name: string;
  /** Visible label text associated with the input via <label for>. */
  label: string;
  /** Input type. "textarea" renders a multi-row <textarea> instead of an <input>. */
  type: 'text' | 'email' | 'textarea';
  /** When true, adds the required attribute and aria-required="true" to the input. */
  required?: boolean;
  /** Placeholder text shown inside the input when empty. */
  placeholder?: string;
}

/** A single statistic rendered as a <dd>/<dt> pair inside a definition list. */
export interface StatItem {
  /** The numeric or textual value (e.g. "99.9%", "10k+"). Rendered in a <dd>. */
  value: string;
  /** Descriptive label for the stat (e.g. "Uptime"). Rendered in a <dt>. */
  label: string;
}

/** A single team member card in the Team section grid. */
export interface TeamMember {
  /** Member's full name, rendered as an <h3> and used as alt text for their photo. */
  name: string;
  /** Job title or role. Visibility controlled by the showRole prop. */
  role?: string;
  /** Short biography paragraph. Visibility controlled by the showBio prop. */
  bio?: string;
  /** URL of the member's photo. Loaded lazily. */
  imageUrl?: string;
}

/** A single event in the Timeline section, rendered as an <li> in an ordered list. */
export interface TimelineEvent {
  /** Date string displayed in a <time> element. Visibility controlled by showDates. */
  date?: string;
  /** Event heading rendered as an <h3>. */
  title: string;
  /** Event description. Supports HTML. */
  text?: string;
}

/** A single logo entry in the LogoCloud section grid. */
export interface LogoItem {
  /** URL of the logo image. Loaded lazily. */
  imageUrl: string;
  /** Alt text for the logo image. Required for accessibility. */
  alt: string;
  /** Optional link wrapping the logo. Opens in a new tab with rel="noopener". */
  href?: string;
}

// ── Portfolio / CV types ────────────────────────────────────

/** A work experience entry in the Portfolio section. */
export interface PortfolioExperience {
  /** Company or organization name. */
  company: string;
  /** Job title or role held. */
  role: string;
  /** Time period string (e.g. "2020 – 2023", "Jan 2021 – Present"). */
  period?: string;
  /** Description of responsibilities or achievements. Supports HTML. */
  description?: string;
  /** Company logo URL. Loaded lazily. */
  logoUrl?: string;
}

/** An education entry in the Portfolio section. */
export interface EducationItem {
  /** Educational institution name. */
  institution: string;
  /** Degree or certification title. */
  degree: string;
  /** Time period string (e.g. "2016 – 2020"). */
  period?: string;
  /** Additional details. Supports HTML. */
  description?: string;
}

/** A skill entry in the Portfolio section. */
export interface SkillItem {
  /** Skill name (e.g. "TypeScript", "Rust", "Project Management"). */
  name: string;
  /** Skill category for grouping (e.g. "Languages", "Frameworks", "Soft Skills"). */
  category?: string;
}

// ── Tag Cloud types ────────────────────────────────────────

/** A single tag in the TagCloud section. */
export interface TagItem {
  /** Tag display label. */
  label: string;
  /** Link URL when the tag is clicked. */
  href?: string;
  /** Item count displayed next to the label (e.g. "(12)"). */
  count?: number;
}

// ── Projects types ─────────────────────────────────────────

/** A project card in the Projects section grid. */
export interface ProjectItem {
  /** Project name rendered as an <h3>. */
  title: string;
  /** Short project description. Supports HTML. */
  description?: string;
  /** Cover image URL. Loaded lazily. */
  imageUrl?: string;
  /** Link to the project page or repository. */
  href?: string;
  /** List of technology or topic tags. */
  tags?: string[];
  /** Project status label (e.g. "Active", "Archived", "In Progress"). */
  status?: string;
}

// ── Blog types ─────────────────────────────────────────────

/** A blog post preview in the Blog section grid. */
export interface BlogPostItem {
  /** Post title rendered as an <h3>. */
  title: string;
  /** Short excerpt or summary text. Supports HTML. */
  excerpt?: string;
  /** Cover image URL. Loaded lazily. */
  imageUrl?: string;
  /** Link to the full blog post. */
  href?: string;
  /** Publication date string displayed in a <time> element. */
  date?: string;
  /** Author name. */
  author?: string;
}

// ── Legal document types ───────────────────────────────────

/**
 * Legal document type identifier.
 * Mirrors LegalDocType from the backend/client.
 */
export type LegalDocType =
  | 'CookieConsent'
  | 'PrivacyPolicy'
  | 'TermsOfService'
  | 'Imprint'
  | 'Disclaimer';

/** Human-readable labels for legal document types. */
// ── Layout component types (Nav, Footer) ───────────────────

/** A navigation item for the Nav and Footer components. */
export interface NavItem {
  /** Display label for the link. */
  title: string;
  /** URL the link points to. */
  href: string;
  /** When true, opens in a new tab with rel="noopener noreferrer". */
  openInNewTab?: boolean;
  /** Nested child items rendered as a dropdown (Nav only). */
  children?: NavItem[];
}

/** A social media link for the Footer component. */
export interface SocialLink {
  /** Platform name (e.g. "GitHub", "Twitter"). */
  title: string;
  /** Full URL to the social profile. */
  url: string;
  /** Icon slug (e.g. "github", "twitter", "linkedin"). Used to select the SVG icon. */
  icon: string;
}

/** A locale option for the language switcher in the Nav. */
export interface LocaleOption {
  /** ISO locale code (e.g. "en", "de", "fr"). */
  code: string;
  /** Human-readable locale name (e.g. "English", "Deutsch"). */
  name: string;
}

export const LEGAL_DOC_TYPE_LABELS: Record<LegalDocType, string> = {
  CookieConsent: 'Cookie Consent',
  PrivacyPolicy: 'Privacy Policy',
  TermsOfService: 'Terms of Service',
  Imprint: 'Imprint',
  Disclaimer: 'Disclaimer',
};
