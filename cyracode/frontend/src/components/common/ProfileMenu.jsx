import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { KeyRound } from 'lucide-react'
import Button from '../common/Button'
import { auth } from '../../services/api'
import { apiErrorMessage } from '../../utils/errors'

export default function ProfileMenu({ user }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const wrapRef = useRef(null)
  const pinnedRef = useRef(false)

  const closeMenu = () => {
    pinnedRef.current = false
    setOpen(false)
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || ''
  const displayName = fullName.trim()
  // AC: names with leading/trailing spaces are trimmed before extracting the
  // first character; if no name is available we fall back to "U".
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeMenu()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const requestReset = async () => {
    if (sending) return
    setSending(true)
    try {
      await auth.requestProfilePasswordReset()
      toast.success(t('nav.reset_link_sent'))
      setConfirmOpen(false)
      closeMenu()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('nav.reset_email_failed')))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      data-testid="profile-menu"
      onMouseLeave={() => {
        if (!pinnedRef.current) setOpen(false)
      }}
    >
      <button
        type="button"
        data-testid="avatar-button"
        onClick={() => {
          pinnedRef.current = true
          setOpen(true)
        }}
        onMouseEnter={() => setOpen(true)}
        aria-label={t('nav.profile_menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30 hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
      >
        {initial}
      </button>

      {open && (
        <div
          data-testid="profile-menu-panel"
          role="menu"
          className="absolute right-0 top-11 w-64 rounded-2xl border border-border bg-white shadow-modal p-4 space-y-4 z-30"
        >
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">{t('nav.full_name')}</p>
            <p data-testid="profile-full-name" className="text-sm text-ink font-medium break-words mt-0.5">
              {displayName || '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">{t('nav.email_address')}</p>
            <p data-testid="profile-email" className="text-sm text-ink break-words mt-0.5">
              {user?.email || '\u2014'}
            </p>
          </div>
          <button
            type="button"
            data-testid="reset-password-button"
            role="menuitem"
            onClick={() => setConfirmOpen(true)}
            className="w-full flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" /> {t('nav.reset_password')}
          </button>
        </div>
      )}

      {confirmOpen &&
        createPortal(
          <div
            data-testid="reset-confirm-modal"
            className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-modal animate-slide-in p-6">
              <h2 className="text-lg font-bold text-ink">{t('nav.reset_password')}</h2>
              <p className="text-sm text-muted mt-1">{t('nav.reset_password_confirm_body')}</p>
              <div className="flex gap-3 mt-6">
                <Button
                  data-testid="reset-confirm-yes"
                  className="flex-1"
                  onClick={requestReset}
                  loading={sending}
                >
                  {t('nav.yes')}
                </Button>
                <Button
                  data-testid="reset-confirm-no"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setConfirmOpen(false)}
                  disabled={sending}
                >
                  {t('nav.no')}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}