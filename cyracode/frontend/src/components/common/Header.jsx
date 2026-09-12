import { Link, useNavigate } from 'react-router-dom'
import { MapPin, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import BackButton from './BackButton'
import LanguageSelector from './LanguageSelector'
import { useAuth } from '../../context/AuthContext'

export default function Header({ showBack = false, backFallback = '/dashboard', breadcrumb = null, maxWidth = 'max-w-3xl' }) {
  const { t } = useTranslation()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  const firstName = user?.first_name || user?.name || ''

  return (
    <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
      <div className={`${maxWidth} mx-auto px-4 h-14 flex items-center gap-2`}>
        {showBack && <BackButton fallbackPath={backFallback} />}
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 shrink-0" aria-label={t('nav.brand')}>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-ink">{t('nav.brand')}</span>
        </Link>
        {breadcrumb && (
          <>
            <span className="text-muted mx-2">/</span>
            <span className="text-sm text-muted">{breadcrumb}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-4">
          <LanguageSelector />
          {isAuthenticated && firstName && (
            <span className="text-sm font-semibold text-ink hidden sm:inline">{firstName}</span>
          )}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> {t('nav.logout')}
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}