import { Link, NavLink, useNavigate } from 'react-router-dom'
import { MapPin, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import BackButton from './BackButton'
import LanguageSelector from './LanguageSelector'
import ProfileMenu from './ProfileMenu'
import { useAuth } from '../../context/AuthContext'

const MARKETING_LINKS = [
  { to: '/pricing', key: 'pricing' },
]

export default function Header({ showBack = false, backFallback = '/dashboard', breadcrumb = null, maxWidth = 'max-w-3xl', marketingNav = false }) {
  const { t } = useTranslation()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  const brandLink = isAuthenticated ? (user?.role === 'admin' ? '/admin' : '/dashboard') : '/'

  return (
    <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
      <div className={`${maxWidth} mx-auto px-4 h-14 flex items-center gap-2`}>
        {showBack && <BackButton fallbackPath={backFallback} />}
        <Link to={brandLink} className="flex items-center gap-2 shrink-0" aria-label={t('nav.brand')}>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-ink">{t('nav.brand')}</span>
        </Link>
        {breadcrumb && (
          <>
            <span className="text-muted mx-2">/</span>
            <span className="text-sm text-muted truncate min-w-0">{breadcrumb}</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {/* Marketing links sit in the right-hand cluster ahead of the language
              selector, so Pricing stays reachable on small screens instead of
              dropping into a full-width panel below the bar. */}
          {marketingNav &&
            MARKETING_LINKS.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'text-primary bg-primary-light/60' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          <LanguageSelector />
          {isAuthenticated && <ProfileMenu user={user} />}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-red-500 hover:bg-surface transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}