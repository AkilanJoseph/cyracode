import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { MapPin, Sparkles, Zap, Search, LogOut, ArrowRight, Loader2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './context/AuthContext'
import { applyDirection, SUPPORTED_LANGUAGES } from './i18n/index'
import LanguageSelector from './components/common/LanguageSelector'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const RegisterTraditional = lazy(() => import('./pages/RegisterTraditional'))
const RegisterAutoGenerate = lazy(() => import('./pages/RegisterAutoGenerate'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const EditAddress = lazy(() => import('./pages/EditAddress'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-label="Loading page">
      <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
    </div>
  )
}

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/" replace />
  return children
}

function Dashboard() {
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/') }

  const actions = [
    { to: '/register/traditional', icon: Sparkles, title: t('dashboard.card_custom_title'), desc: t('dashboard.card_custom_desc'), primary: true },
    { to: '/register/auto-generate', icon: Zap, title: t('dashboard.card_auto_title'), desc: t('dashboard.card_auto_desc'), primary: false },
    { to: '/search', icon: Search, title: t('dashboard.card_search_title'), desc: t('dashboard.card_search_desc'), primary: false },
    { to: '/edit-address', icon: Pencil, title: t('dashboard.card_edit_title'), desc: t('dashboard.card_edit_desc'), primary: false },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2" aria-label={t('nav.brand')}>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-ink">{t('nav.brand')}</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary mb-1">{t('dashboard.workspace')}</p>
          <h1 className="text-3xl font-bold text-ink">
            {user ? t('dashboard.welcome', { name: user.first_name }) : 'Dashboard'}
          </h1>
          <p className="text-muted mt-1">{t('dashboard.subtitle')}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {actions.map(({ to, icon: Icon, title, desc, primary }) => (
            <Link
              key={to}
              to={to}
              className={`group rounded-2xl p-5 border transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${
                primary ? 'bg-primary border-primary text-white' : 'bg-white border-border text-ink hover:border-primary/40'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${primary ? 'bg-white/20' : 'bg-primary-light'}`}>
                <Icon className={`w-5 h-5 ${primary ? 'text-white' : 'text-primary'}`} />
              </div>
              <p className={`font-semibold text-sm leading-tight ${primary ? 'text-white' : 'text-ink'}`}>{title}</p>
              <p className={`text-xs mt-1 leading-snug ${primary ? 'text-white/70' : 'text-muted'}`}>{desc}</p>
              <div className={`flex items-center gap-1 text-xs font-medium mt-4 ${primary ? 'text-white/80' : 'text-primary'}`}>
                {t('dashboard.get_started')}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { i18n, t } = useTranslation()

  useEffect(() => {
    const lang = localStorage.getItem('cyracode_lang') || i18n.language?.split('-')[0] || 'en'
    applyDirection(lang)
  }, [i18n.language])

  return (
    <>
      <a href="#main-content" className="skip-link">{t('common.skip_to_content')}</a>
      <BrowserRouter>
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register/traditional" element={<ProtectedRoute><RegisterTraditional /></ProtectedRoute>} />
          <Route path="/register/auto-generate" element={<ProtectedRoute><RegisterAutoGenerate /></ProtectedRoute>} />
          <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/edit-address" element={<ProtectedRoute><EditAddress /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </>
  )
}

function AppShell() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default function App() {
  if (!VITE_GOOGLE_CLIENT_ID) return <AppShell />
  return (
    <GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
      <AppShell />
    </GoogleOAuthProvider>
  )
}
