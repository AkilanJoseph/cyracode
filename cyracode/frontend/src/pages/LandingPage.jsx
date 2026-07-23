import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MapPin, Sparkles, Search, ArrowRight, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGoogleLogin } from '@react-oauth/google'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import LanguageSelector from '../components/common/LanguageSelector'
import { useAuth } from '../context/AuthContext'
import { auth } from '../services/api'

const REMEMBER_EMAIL_KEY = 'cyracode_remember_email'

function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const strengthColors = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500']
const strengthTextColors = ['text-red-500', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500']

function FeaturePill({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-medium">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showModeSelect, setShowModeSelect] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: false })
  const [loginErrors, setLoginErrors] = useState({})

  const [regForm, setRegForm] = useState({ first_name: '', last_name: '', email: '', password: '', gdpr: false })
  const [regErrors, setRegErrors] = useState({})

  // Pre-populate email from Remember Me
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY)
    if (savedEmail) setLoginForm((f) => ({ ...f, email: savedEmail, remember: true }))
  }, [])

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleLogin = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!loginForm.email.trim()) {
      errors.email = t('common.required')
    } else if (!validateEmail(loginForm.email)) {
      errors.email = t('errors.invalid_email')
    }
    if (!loginForm.password) errors.password = t('common.required')
    setLoginErrors(errors)
    if (Object.keys(errors).length) {
      setTimeout(() => {
        if (errors.email) document.getElementById('login-email')?.focus()
        else if (errors.password) document.getElementById('login-password')?.focus()
      }, 0)
      return
    }

    setLoading(true)
    try {
      const { data } = await auth.login(loginForm.email, loginForm.password, loginForm.remember)
      login(data.access_token, data.user)

      if (loginForm.remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, loginForm.email)
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }

      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.login_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!regForm.first_name.trim()) errors.first_name = t('common.required')
    if (!regForm.last_name.trim()) errors.last_name = t('common.required')
    if (!regForm.email.trim()) {
      errors.email = t('common.required')
    } else if (!validateEmail(regForm.email)) {
      errors.email = t('errors.invalid_email')
    }
    if (!regForm.password) {
      errors.password = t('common.required')
    } else if (passwordStrength(regForm.password) < 4) {
      errors.password = t('landing.password_hint')
    }
    if (!regForm.gdpr) errors.gdpr = t('errors.gdpr_required')
    setRegErrors(errors)
    if (Object.keys(errors).length) {
      setTimeout(() => {
        const fieldOrder = [
          { key: 'first_name', id: 'reg-first-name' },
          { key: 'last_name', id: 'reg-last-name' },
          { key: 'email', id: 'reg-email' },
          { key: 'password', id: 'reg-password' },
        ]
        const first = fieldOrder.find(({ key }) => errors[key])
        if (first) document.getElementById(first.id)?.focus()
      }, 0)
      return
    }

    setLoading(true)
    try {
      const { data } = await auth.register(
        regForm.first_name,
        regForm.last_name,
        regForm.email,
        regForm.password,
        true, // gdpr_consent
      )
      login(data.access_token, data.user)
      toast.success('Account created!')
      setShowModeSelect(true)
    } catch (err) {
      if (err.response?.status === 409) {
        setRegErrors((prev) => ({ ...prev, email: err.response.data.detail }))
        setTimeout(() => document.getElementById('reg-email')?.focus(), 0)
      } else {
        toast.error(err.response?.data?.detail || t('errors.register_failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      try {
        // For token response (implicit flow), use access_token to fetch user info
        // then pass id_token if available, or handle with backend
        const credential = tokenResponse.credential || tokenResponse.access_token
        const { data } = await auth.googleAuth(credential)
        login(data.access_token, data.user)
        toast.success('Signed in with Google!')
        setShowModeSelect(true)
      } catch (err) {
        toast.error(err.response?.data?.detail || t('errors.google_failed'))
      } finally {
        setLoading(false)
      }
    },
    onError: () => toast.error(t('errors.google_failed')),
    flow: 'implicit',
  })

  const strength = passwordStrength(regForm.password)

  return (
    <div className="min-h-screen bg-surface">
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink">{t('nav.brand')}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button
              onClick={() => navigate('/search')}
              className="text-sm text-muted hover:text-ink flex items-center gap-1.5 transition-colors"
            >
              <Search className="w-4 h-4" /> {t('nav.search')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16 grid md:grid-cols-2 gap-8 md:gap-16 items-center">
        {/* Hero */}
        <div className="animate-fade-in-up order-2 md:order-none">
          <div className="flex flex-wrap gap-2 mb-6">
            <FeaturePill icon={MapPin} label={t('landing.pill_precise')} />
            <FeaturePill icon={Zap} label={t('landing.pill_instant')} />
            <FeaturePill icon={Sparkles} label={t('landing.pill_custom')} />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink leading-[1.08] tracking-tight">
            {t('landing.hero_title')}{' '}
            <span className="text-primary">{t('landing.hero_accent')}</span>
          </h1>
          <p className="mt-5 text-lg text-muted leading-relaxed max-w-md">
            {t('landing.hero_subtitle')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3">
            <Button size="lg" onClick={() => navigate('/register/traditional')} className="group">
              <Sparkles className="w-4 h-4" />
              {t('landing.btn_custom')}
              <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/register/auto-generate')}>
              {t('landing.btn_auto')}
            </Button>
          </div>

          <div className="mt-10 pt-8 border-t border-border grid grid-cols-3 gap-4">
            {[
              { value: '10m', label: t('landing.stat_accuracy') },
              { value: '12', label: t('landing.stat_chars') },
              { value: '∞', label: t('landing.stat_locations') },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-ink">{value}</p>
                <p className="text-xs text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auth card */}
        <div className="bg-white rounded-3xl shadow-card border border-border p-6 sm:p-8 animate-fade-in-up order-1 md:order-none">
          <div className="flex gap-1 mb-7 bg-surface rounded-xl p-1 border border-border">
            {['login', 'signup'].map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === tabKey ? 'bg-white shadow-card text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {tabKey === 'login' ? t('landing.tab_login') : t('landing.tab_signup')}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                id="login-email"
                label={t('landing.email')}
                type="email"
                placeholder={t('landing.email_placeholder')}
                value={loginForm.email}
                onChange={(e) => {
                  const val = e.target.value
                  setLoginForm({ ...loginForm, email: val })
                  if (loginErrors.email && validateEmail(val)) {
                    setLoginErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value
                  if (!val.trim()) {
                    setLoginErrors((prev) => ({ ...prev, email: t('common.required') }))
                  } else if (!validateEmail(val)) {
                    setLoginErrors((prev) => ({ ...prev, email: t('errors.invalid_email') }))
                  } else {
                    setLoginErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                error={loginErrors.email}
              />
              <Input
                id="login-password"
                label={t('landing.password')}
                type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                error={loginErrors.password}
              />
              <div className="flex items-center justify-between text-xs text-muted">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={loginForm.remember}
                    onChange={(e) => setLoginForm({ ...loginForm, remember: e.target.checked })}
                    className="accent-primary w-3.5 h-3.5"
                  />
                  {t('landing.remember_me')}
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-primary hover:text-primary-dark transition-colors font-medium"
                >
                  {t('landing.forgot_password')}
                </button>
              </div>
              <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                {t('landing.btn_login')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="reg-first-name"
                  label={t('landing.first_name')}
                  placeholder="Jane"
                  value={regForm.first_name}
                  onChange={(e) => {
                    const val = e.target.value
                    setRegForm({ ...regForm, first_name: val })
                    if (regErrors.first_name && val.trim()) {
                      setRegErrors((prev) => ({ ...prev, first_name: undefined }))
                    }
                  }}
                  error={regErrors.first_name}
                />
                <Input
                  id="reg-last-name"
                  label={t('landing.last_name')}
                  placeholder="Doe"
                  value={regForm.last_name}
                  onChange={(e) => {
                    const val = e.target.value
                    setRegForm({ ...regForm, last_name: val })
                    if (regErrors.last_name && val.trim()) {
                      setRegErrors((prev) => ({ ...prev, last_name: undefined }))
                    }
                  }}
                  error={regErrors.last_name}
                />
              </div>
              <Input
                id="reg-email"
                label={t('landing.email')}
                type="email"
                placeholder={t('landing.email_placeholder')}
                value={regForm.email}
                onChange={(e) => {
                  const val = e.target.value
                  setRegForm({ ...regForm, email: val })
                  if (regErrors.email && validateEmail(val)) {
                    setRegErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value
                  if (!val.trim()) {
                    setRegErrors((prev) => ({ ...prev, email: t('common.required') }))
                  } else if (!validateEmail(val)) {
                    setRegErrors((prev) => ({ ...prev, email: t('errors.invalid_email') }))
                  } else {
                    setRegErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                error={regErrors.email}
              />
              <Input
                id="reg-password"
                label={t('landing.password')}
                type="password"
                placeholder="••••••••"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                error={regErrors.password}
              />
              {regForm.password && (
                <div>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < strength ? strengthColors[strength] : 'bg-border'}`} />
                    ))}
                  </div>
                  <p className={`mt-1.5 text-xs font-medium ${strengthTextColors[strength]}`}>
                    {t(`strength.${strength}`)}
                  </p>
                </div>
              )}

              {/* GDPR Consent */}
              <div>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={regForm.gdpr}
                    onChange={(e) => setRegForm({ ...regForm, gdpr: e.target.checked })}
                    className="accent-primary w-3.5 h-3.5 mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-muted">
                    {t('landing.gdpr_text')}{' '}
                    <button
                      type="button"
                      className="text-primary underline hover:text-primary-dark"
                      onClick={() => window.open('/privacy', '_blank')}
                    >
                      {t('landing.gdpr_policy')}
                    </button>{' '}
                    {t('landing.gdpr_and')}
                  </span>
                </label>
                {regErrors.gdpr && <p className="mt-1 text-xs text-red-500">{regErrors.gdpr}</p>}
              </div>

              <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                {t('landing.btn_create')}
              </Button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <div className="flex-1 h-px bg-border" />
            {t('landing.or_continue')}
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={() => googleLogin()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-ink hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt=""
              className="w-4 h-4"
              loading="lazy"
              width="16"
              height="16"
            />
            {t('landing.btn_google')}
          </button>
        </div>
      </div>

      {/* Mode selection modal */}
      {showModeSelect && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-modal animate-slide-in">
            <h2 className="text-xl font-bold text-ink">{t('landing.mode_title')}</h2>
            <p className="text-sm text-muted mt-1 mb-6">{t('landing.mode_subtitle')}</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/register/traditional')}
                className="w-full text-left border border-border rounded-2xl p-4 hover:border-primary hover:bg-primary-light transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{t('landing.mode_custom_title')}</p>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted mt-0.5">{t('landing.mode_custom_desc')}</p>
              </button>
              <button
                onClick={() => navigate('/register/auto-generate')}
                className="w-full text-left border border-border rounded-2xl p-4 hover:border-primary hover:bg-primary-light transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{t('landing.mode_auto_title')}</p>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted mt-0.5">{t('landing.mode_auto_desc')}</p>
              </button>
            </div>
            <button
              onClick={() => setShowModeSelect(false)}
              className="mt-5 w-full text-sm text-muted hover:text-ink transition-colors py-1"
            >
              {t('landing.maybe_later')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
