import { Link } from 'react-router-dom'
import { MapPin, Twitter, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useContactWidget } from '../../context/ContactWidgetContext'
import Tagline from './Tagline'

// Edit these if the brand accounts change.
const SOCIAL_LINKS = [
  { href: 'https://x.com/cyracode', key: 'social_x', Icon: Twitter },
  { href: 'https://facebook.com/cyracode', key: 'social_facebook', Icon: Facebook },
  { href: 'https://instagram.com/cyracode', key: 'social_instagram', Icon: Instagram },
  { href: 'https://linkedin.com/company/cyracode', key: 'social_linkedin', Icon: Linkedin },
  { href: 'https://youtube.com/@cyracode', key: 'social_youtube', Icon: Youtube },
]

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
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()

  const brandLink = isAuthenticated ? (user?.role === 'admin' ? '/admin' : '/dashboard') : '/'
  const year = new Date().getFullYear()

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
      &copy; {year} {t('nav.brand')}. {t('footer.rights_reserved')} · {t('language.label')}: {currentLang.toUpperCase()} ({country})}
    </p>
  )

  const socials = (
    <nav
      aria-label={t('footer.follow_us')}
      className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
    >
      {SOCIAL_LINKS.map(({ href, key, Icon }) => {
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
            <Icon className="w-4 h-4" aria-hidden="true" />
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
          {socials}
        </div>
      </div>
    </footer>
  )
}
