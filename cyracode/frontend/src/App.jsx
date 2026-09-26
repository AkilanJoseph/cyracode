import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { Sparkles, Zap, ArrowRight, Loader2, Pencil, CreditCard, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './context/AuthContext'
import { applyDirection } from './i18n/index'
import Header from './components/common/Header'
import { billing } from './services/api'
import { PENDING_MODE_SELECT_KEY } from './constants'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const RegisterTraditional = lazy(() => import('./pages/RegisterTraditional'))
const RegisterAutoGenerate = lazy(() => import('./pages/RegisterAutoGenerate'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ManageCyraCodes = lazy(() => import('./pages/ManageCyraCodes'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminCyraCodes = lazy(() => import('./pages/AdminCyraCodes'))
const AdminClients = lazy(() => import('./pages/AdminClients'))
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions'))
const AdminPlans = lazy(() => import('./pages/AdminPlans'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-label="Loading page">
      <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
    </div>
  )
}

// Placeholder for docs/blog (content lives in later modules); keeps the
// marketing nav links from dead-ending.
function ComingSoonPage({ title }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-6xl" marketingNav />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-muted">{t('common.coming_soon')}</p>
      </main>
    </div>
  )
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

// Logs the user out automatically after 15 minutes without user interaction,
// showing a message so they know why they were signed out.
function InactivityLogout() {
  const { logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    if (!isAuthenticated) return
    lastActivityRef.current = Date.now()

    const reset = () => {
      lastActivityRef.current = Date.now()
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))

    const check = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        logout()
        toast(t('session.inactivity_message'), { id: 'inactivity-logout', duration: 6000 })
        navigate('/', { replace: true })
      }
    }, 30000)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset))
      clearInterval(check)
    }
  }, [isAuthenticated, logout, navigate, t])

  return null
}

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/" replace />
  return children
}

// The Admin Portal is only reachable by users who hold the Admin role. The
// backend enforces the same rule on every /admin/* endpoint, but routing the
// UI up-front keeps non-admins from even rendering the admin pages.
export function AdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (!user?.role || user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

// The login/landing page is only reachable when signed out. If an authenticated
// user lands on "/" (e.g. browser back from a protected page), send them to the
// dashboard instead. Logout clears the token first, then navigates to "/", so
// the login page is only ever shown after an explicit logout.
// Exception: right after registration the LandingPage sets a pending flag so it
// can stay mounted and show the mode-select modal before the redirect kicks in.
function HomeRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return null
  if (isAuthenticated && !sessionStorage.getItem(PENDING_MODE_SELECT_KEY)) {
    // Admins land in the Admin Portal; everyone else in the client dashboard.
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }
  return children
}

// The Dashboard shown to regular Users (role: User). Client/Admin experiences
// are role-specific and added alongside their dedicated user types.

export function Dashboard() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    if (!user?.email) return
    let active = true
    billing.listOrders(user.email)
      .then(({ data }) => {
        if (active) setSubscription((data || []).find((o) => o.status === 'paid') || null)
      })
      .catch(() => { if (active) setSubscription(null) })
    return () => { active = false }
  }, [user?.email])

  const renewal = subscription?.created_at ? new Date(subscription.created_at) : null
  if (renewal) renewal.setMonth(renewal.getMonth() + (subscription?.billing_frequency === 'annual' ? 12 : 1))

  const actions = [
    { to: '/register/traditional', icon: Sparkles, title: t('dashboard.card_custom_title'), desc: t('dashboard.card_custom_desc') },
    { to: '/register/auto-generate', icon: Zap, title: t('dashboard.card_auto_title'), desc: t('dashboard.card_auto_desc') },
    { to: '/manage-cyracodes', icon: Pencil, title: t('dashboard.card_edit_title'), desc: t('dashboard.card_edit_desc') },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        {/* Brand slogan as a rolling ticker, shown only on the user dashboard. */}
        <div className="marquee-track relative mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary-light/60 py-2 sm:py-2.5">
          <div className="flex w-max animate-marquee">
            {[0, 1].map((copy) => (
              <span
                key={copy}
                aria-hidden={copy === 1 ? 'true' : undefined}
                className="flex items-center gap-4 sm:gap-6 whitespace-nowrap px-4 sm:px-6 text-sm sm:text-base font-semibold text-primary"
              >
                {t('nav.tagline')}
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <p className="text-sm font-medium text-primary mb-1">{t('dashboard.workspace')}</p>
          <h1 className="text-3xl font-bold text-ink">
            {user ? t('dashboard.welcome', { name: user.first_name }) : 'Dashboard'}
          </h1>
          <p className="text-muted mt-1">{t('dashboard.subtitle')}</p>
        </div>

        <section className="mb-8 rounded-2xl border border-border bg-white p-6 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('dashboard.subscription')}</p>
              {subscription ? (
                <>
                  <p className="mt-1 text-lg font-bold text-ink">{subscription.plan_name}</p>
                  <p className="text-sm text-muted">
                    {t('dashboard.renews_on', {
                      date: renewal ? renewal.toLocaleDateString() : '—',
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    <CreditCard className="w-3.5 h-3.5 inline-block mr-1" aria-hidden="true" />
                    {t(`dashboard.method_${subscription.payment_method || 'card'}`)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-lg font-bold text-ink">{t('dashboard.no_subscription')}</p>
                  <p className="text-sm text-muted">{t('dashboard.no_subscription_hint')}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {subscription && (
                <Link
                  to={`/orders?email=${encodeURIComponent(subscription.email)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  {t('dashboard.view_orders')}
                </Link>
              )}
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                {subscription ? t('dashboard.upgrade') : t('dashboard.choose_plan')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-4">
          {actions.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="group relative overflow-hidden rounded-2xl p-5 border border-border bg-white text-ink transition-all duration-300 hover:border-primary/40 hover:shadow-card-hover hover:-translate-y-1"
            >
              <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/25">
                <Icon className="w-5 h-5 text-primary transition-colors duration-300 group-hover:text-white" aria-hidden="true" />
              </div>
              <p className="font-semibold text-sm leading-tight text-ink">{title}</p>
              <p className="text-xs mt-1 leading-snug text-muted">{desc}</p>
              <div className="flex items-center gap-1 text-xs font-medium mt-4 text-primary">
                {t('dashboard.get_started')}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
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
      <InactivityLogout />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomeRoute><LandingPage /></HomeRoute>} />
          <Route path="/register/traditional" element={<ProtectedRoute><RegisterTraditional /></ProtectedRoute>} />
          <Route path="/register/auto-generate" element={<ProtectedRoute><RegisterAutoGenerate /></ProtectedRoute>} />
          <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/manage-cyracodes" element={<ProtectedRoute><ManageCyraCodes /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Alias so both /pricing and /plans-and-pricing bookmarks work. */}
          <Route path="/plans-and-pricing" element={<Navigate to="/pricing" replace />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/docs" element={<ComingSoonPage title={t('nav.docs')} />} />
          <Route path="/blog" element={<ComingSoonPage title={t('nav.blog')} />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/cyracodes" element={<AdminRoute><AdminCyraCodes /></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
          <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
          <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/audit" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
