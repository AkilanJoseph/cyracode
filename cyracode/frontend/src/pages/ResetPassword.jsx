import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { MapPin, KeyRound } from 'lucide-react'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import { auth } from '../services/api'

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

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!newPassword) {
      errs.newPassword = t('common.required')
    } else if (passwordStrength(newPassword) < 4) {
      errs.newPassword = t('landing.password_hint')
    }
    if (!confirmPassword) {
      errs.confirmPassword = t('common.required')
    } else if (newPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = t('reset.mismatch')
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    if (!token) {
      toast.error(t('reset.invalid_token'))
      return
    }
    setLoading(true)
    try {
      await auth.resetPassword(token, newPassword)
      toast.success(t('reset.success'))
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('reset.invalid_token'))
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength(newPassword)

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-ink">CyraCode</span>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl shadow-card border border-border p-8 w-full max-w-sm animate-fade-in-up">
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-light mb-4">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-ink">{t('reset.title')}</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                id="reset-password"
                label={t('reset.new_password')}
                type="password"
                value={newPassword}
                onChange={(e) => {
                  const val = e.target.value
                  setNewPassword(val)
                  if (errors.newPassword && passwordStrength(val) >= 4) {
                    setErrors((prev) => ({ ...prev, newPassword: undefined }))
                  }
                }}
                error={errors.newPassword}
              />
              {newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i < strength ? strengthColors[strength] : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`mt-1.5 text-xs font-medium ${strengthTextColors[strength]}`}>
                    {t(`strength.${strength}`)}
                  </p>
                </div>
              )}
            </div>
            <Input
              id="reset-confirm"
              label={t('reset.confirm_password')}
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                const val = e.target.value
                setConfirmPassword(val)
                if (errors.confirmPassword && val === newPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }
              }}
              error={errors.confirmPassword}
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {t('reset.submit')}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <Link to="/" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">
              {t('reset.back_login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
