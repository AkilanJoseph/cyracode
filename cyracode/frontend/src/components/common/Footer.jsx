import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useContactWidget } from '../../context/ContactWidgetContext'
import Tagline from './Tagline'
import { SUPPORTED_LANGUAGES } from '../../i18n/index'

// Edit these if the brand accounts change.
const SOCIAL_LINKS = [
  { href: 'https://x.com/cyracode', key: 'social_x', brand: 'x' },
  { href: 'https://facebook.com/cyracode', key: 'social_facebook', brand: 'facebook' },
  { href: 'https://instagram.com/cyracode', key: 'social_instagram', brand: 'instagram' },
  { href: 'https://linkedin.com/company/cyracode', key: 'social_linkedin', brand: 'linkedin' },
  { href: 'https://youtube.com/@cyracode', key: 'social_youtube', brand: 'youtube' },
]

// The platforms' official marks (Simple Icons, CC0) — lucide only ships
// generic glyphs for social brands. Painted with currentColor so the footer's
// muted → primary hover behaviour still applies.
const BRAND_PATHS = {
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  facebook:
    'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  instagram:
    'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
}

function BrandIcon({ brand, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={BRAND_PATHS[brand]} />
    </svg>
  )
}

// Shown as a plain line under the logo/tagline. Widget enquiries are delivered
// to this address by backend/app/api/contact.py; keep in sync with PrivacyPolicy.
const SUPPORT_EMAIL = 'support@cyracode.com'

const GROUPS = [
  {
    heading: 'footer.product',
    links: [{ to: '/pricing', key: 'nav.pricing' }],
  },
  {
    // Temporarily hidden. The definition is kept so the columns come back in
    // their original order with a one-word change; drop `hidden` to restore.
    heading: 'footer.sales',
    hidden: true,
    links: [{ to: '/orders', key: 'footer.orders' }],
  },
  {
    heading: 'footer.account',
    hidden: true,
    links: [
      { to: '/dashboard', key: 'footer.dashboard' },
      { to: '/manage-cyracodes', key: 'footer.manage' },
      { to: '/search', key: 'footer.search' },
    ],
  },
  {
    heading: 'footer.legal',
    links: [{ to: '/privacy', key: 'footer.privacy' }],
  },
  {
    // Its own column rather than a row inside Legal: it now carries the
    // help content, which is too much to stack under a single policy link.
    heading: 'footer.support',
    links: [
      { to: '/blog', key: 'nav.blog' },
      { to: '/docs', key: 'nav.docs' },
      { to: '/faqs', key: 'footer.faqs' },
      // Temporarily hidden, like the Sales and Account columns. The entry is
      // kept in place so it returns in the right order; drop `hidden` to
      // restore. The /sitemap route stays live.
      { to: '/sitemap', key: 'footer.sitemap', hidden: true },
      // Opens the Contact-us widget rather than handing off to the mail client,
      // so the visitor is not dumped into a blank compose window. Kept last so
      // the enquiry action follows the reference links.
      { action: 'contact', key: 'footer.contact_us' },
    ],
  },
]

// Groups flagged `hidden` are skipped without losing their place in GROUPS.
const VISIBLE_GROUPS = GROUPS.filter((group) => !group.hidden)

function LinkList({ links }) {
  const { t } = useTranslation()
  const { open: openContact } = useContactWidget()
  const linkClass = 'text-sm text-muted hover:text-primary transition-colors text-left'

  return (
    <ul className="mt-3 space-y-2">
      {/* Same `hidden` convention as the groups above, applied per link. */}
      {links.filter((link) => !link.hidden).map(({ to, key, action }) => (
        <li key={to || action}>
          {action === 'contact' ? (
            <button type="button" onClick={openContact} className={linkClass}>
              {t(key)}
            </button>
          ) : (
            <Link to={to} className="text-sm text-muted hover:text-primary transition-colors">
              {t(key)}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

function FooterGroup({ heading, links }) {
  const { t } = useTranslation()
  const headingClass = 'text-xs font-semibold uppercase tracking-wide text-primary'

  return (
    <div>
      <nav aria-label={t(heading)}>
        <p className={headingClass}>{t(heading)}</p>
        <LinkList links={links} />
      </nav>
    </div>
  )
}

export default function Footer({ maxWidth = 'max-w-3xl', variant = 'full' }) {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated } = useAuth()

  const brandLink = isAuthenticated ? (user?.role === 'admin' ? '/admin' : '/dashboard') : '/'
  const year = new Date().getFullYear()

  // Active UI language, shown by full name (e.g. "English"), not a code.
  const currentLang = (i18n.language || 'en').split('-')[0] || 'en'
  const languageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label || currentLang.toUpperCase()

  const brand = (
    <Link to={brandLink} className="flex items-center gap-2 w-fit" aria-label={t('nav.brand')}>
      <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
        <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
      </span>
      <span className="font-bold text-ink">{t('nav.brand')}</span>
    </Link>
  )

  const copyright = (
    <p className="text-xs text-muted text-center sm:text-left">
      &copy; {year} {t('nav.brand')}. {t('footer.rights_reserved')}
    </p>
  )

  // Sits on the right of the bottom bar, immediately before the social links.
  const languageText = (
    <p className="text-xs text-muted font-bold" lang={currentLang}>
      {languageName}
    </p>
  )

  const socials = (
    <nav
      aria-label={t('footer.follow_us')}
      className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
    >
      {SOCIAL_LINKS.map(({ href, key, brand }) => {
        const label = t(`footer.${key}`)
        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className="w-9 h-9 rounded-lg border border-border text-muted flex items-center justify-center hover:text-primary hover:border-primary/40 hover:bg-primary-light/50 transition-colors"
          >
            <BrandIcon brand={brand} className="w-4 h-4" />
          </a>
        )
      })}
    </nav>
  )

  // Admin pages show only the brand, slogan, social links and copyright.
  if (variant === 'minimal') {
    return (
      <footer className="border-t border-border bg-white">
        <div className={`${maxWidth} mx-auto px-4 py-8`}>
          <div className="flex flex-col items-center text-center gap-4">
            {brand}
            {/* Admin pages keep the slogan on a single centred line. */}
            <Tagline className="mt-3 text-sm text-muted max-w-sm leading-relaxed" />
            {languageText}
            {socials}
            {copyright}
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-border bg-white">
      <div className={`${maxWidth} mx-auto px-4 py-8 sm:py-10`}>
        {/* Track math: brand takes 2, each visible menu group takes 1. At lg
            that is 2 + 3 = 5 columns on one row. From sm the brand takes the
            whole row so the three menu groups share one even row instead of
            leaving the last column alone. */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="sm:col-span-3 lg:col-span-2">
            {brand}
            <Tagline
              layout="stacked"
              className="mt-3 text-sm text-muted max-w-xs leading-relaxed"
            />
            {/* Admin uses the minimal variant, so this only shows on public pages. */}
            <p className="mt-3 text-sm text-muted max-w-xs leading-relaxed">
              {t('footer.queries')}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-1 inline-block text-sm font-medium text-primary hover:underline
                whitespace-nowrap"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          {VISIBLE_GROUPS.map((group) => (
            <FooterGroup key={group.heading} {...group} />
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {copyright}
          <div className="flex items-center gap-4">
            {languageText}
            {socials}
          </div>
        </div>
      </div>
    </footer>
  )
}
