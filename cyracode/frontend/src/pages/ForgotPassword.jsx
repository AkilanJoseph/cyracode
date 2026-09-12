import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Mail, CheckCircle } from 'lucide-react'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Header from '../components/common/Header'
import { auth } from '../services/api'

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export default function ForgotPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setEmailError(t('common.required'))
      document.getElementById('forgot-email')?.focus()
      return
    }
    if (!validateEmail(email)) {
      setEmailError(t('errors.invalid_email'))
      document.getElementById('forgot-email')?.focus()
      return
    }
    setEmailError('')
    setLoading(true)
    try {
      await auth.forgotPassword(email)
      setSubmitted(true)
    } catch {
      toast.error(t('errors.register_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header showBack backFallback="/" maxWidth="max-w-6xl" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl shadow-card border border-border p-8 w-full max-w-sm animate-fade-in-up">
          {submitted ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-ink">{t('forgot.success_title')}</h1>
              <p className="text-sm text-muted mt-2 leading-relaxed">{t('forgot.success_subtitle')}</p>
              <Link
                to="/"
                className="inline-block mt-6 text-sm text-primary hover:text-primary-dark font-medium transition-colors"
              >
                {t('forgot.back_login')}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-light mb-4">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-ink">{t('forgot.title')}</h1>
                <p className="text-sm text-muted mt-2">{t('forgot.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  id="forgot-email"
                  label={t('forgot.email')}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value
                    setEmail(val)
                    if (emailError && validateEmail(val)) setEmailError('')
                  }}
                  onBlur={(e) => {
                    const val = e.target.value
                    if (!val.trim()) setEmailError(t('common.required'))
                    else if (!validateEmail(val)) setEmailError(t('errors.invalid_email'))
                    else setEmailError('')
                  }}
                  error={emailError}
                />
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  {t('forgot.btn_send')}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/"
                  className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
                >
                  {t('forgot.back_login')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
