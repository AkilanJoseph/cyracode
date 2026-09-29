import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, X, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { contact } from '../../services/api'
import { useContactWidget } from '../../context/ContactWidgetContext'
import { apiErrorMessage } from '../../utils/errors'
import Input from './Input'
import Button from './Button'

const EMPTY = { name: '', email: '', address: '', message: '' }

// Deliberately permissive: the backend is the authority on validity, and a
// stricter pattern here would reject valid addresses and only shift the error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'name'
  if (!values.email.trim()) errors.email = 'email'
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = 'email'
  if (!values.address.trim()) errors.address = 'address'
  if (!values.message.trim()) errors.message = 'message'
  return errors
}

/**
 * Floating "Contact us" widget: a launcher button that opens a panel holding
 * the enquiry form. Open state lives in ContactWidgetContext so the footer's
 * Support link can open it too.
 */
export default function ContactWidget() {
  const { t } = useTranslation()
  const { isOpen: open, close, toggle } = useContactWidget()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [failure, setFailure] = useState(null)
  const panelRef = useRef(null)
  const launcherRef = useRef(null)

  const setField = (field) => (e) => {
    const { value } = e.target
    setValues((v) => ({ ...v, [field]: value }))
    // Clear the error as soon as the visitor starts fixing that field.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  // Closing always returns focus to the launcher, which is the stable control
  // for the panel regardless of whether the footer link or the button opened it.
  const handleClose = useCallback(() => {
    close()
    launcherRef.current?.focus()
  }, [close])

  // Escape closes, and focus moves into the panel when it opens so keyboard and
  // screen-reader users land on the form rather than behind it. Input is not
  // ref-forwarding, so the first field is reached through the panel.
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector('input, textarea')?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status === 'sending') return

    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return

    setStatus('sending')
    setFailure(null)
    try {
      await contact.send({
        name: values.name.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        message: values.message.trim(),
      })
      setStatus('sent')
      setValues(EMPTY)
    } catch (err) {
      setFailure(err)
      setStatus('error')
    }
  }

  // After a successful send, collapse back to the launcher once the confirmation
  // has had time to register.
  useEffect(() => {
    if (status !== 'sent') return
    const timer = setTimeout(() => {
      setStatus('idle')
      close()
    }, 4000)
    return () => clearTimeout(timer)
  }, [status, close])

  const errText = (field) => (errors[field] ? t(`contact.error_${field}`) : undefined)

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="contact-widget-panel"
        aria-label={open ? t('contact.close') : t('contact.open')}
        data-testid="contact-launcher"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full
          bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg
          hover:bg-primary-dark active:scale-95 transition-all"
      >
        {open ? (
          <X className="w-5 h-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{open ? t('contact.close') : t('contact.title')}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id="contact-widget-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-widget-title"
            data-testid="contact-widget"
            className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm
              bg-white rounded-3xl shadow-modal animate-slide-in
              max-h-[calc(100vh-8rem)] overflow-y-auto"
          >
            <div className="p-5 sm:p-6">
              <h2 id="contact-widget-title" className="text-lg font-bold text-ink">
                {t('contact.title')}
              </h2>
              <p className="mt-1 text-sm text-muted">{t('contact.subtitle')}</p>

              {status === 'sent' ? (
                <div
                  role="status"
                  data-testid="contact-success"
                  className="mt-5 flex items-start gap-2.5 rounded-2xl bg-green-50 p-4"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-green-800">{t('contact.success')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3.5">
                  <Input
                    label={t('contact.name')}
                    value={values.name}
                    onChange={setField('name')}
                    error={errText('name')}
                    maxLength={120}
                    autoComplete="name"
                    required
                  />
                  <Input
                    label={t('contact.email')}
                    type="email"
                    value={values.email}
                    onChange={setField('email')}
                    error={errText('email')}
                    maxLength={255}
                    autoComplete="email"
                    required
                  />
                  <Input
                    label={t('contact.address')}
                    value={values.address}
                    onChange={setField('address')}
                    error={errText('address')}
                    maxLength={300}
                    autoComplete="street-address"
                    required
                  />

                  <div className="w-full">
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5"
                    >
                      {t('contact.message')}
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      value={values.message}
                      onChange={setField('message')}
                      aria-invalid={errors.message ? 'true' : undefined}
                      aria-describedby={errors.message ? 'contact-message-error' : undefined}
                      maxLength={4000}
                      required
                      placeholder={t('contact.message_placeholder')}
                      className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none
                        transition-all duration-150 text-ink placeholder-slate-400
                        focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white
                        resize-y ${errors.message ? 'border-red-400' : 'border-border hover:border-slate-300'}`}
                    />
                    {errors.message && (
                      <p id="contact-message-error" role="alert" className="mt-1.5 text-xs text-red-500">
                        {t('contact.error_message')}
                      </p>
                    )}
                  </div>

                  {status === 'error' && (
                    <p
                      role="alert"
                      data-testid="contact-error"
                      className="flex items-start gap-2 text-sm text-red-600"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      {apiErrorMessage(failure, t('contact.send_failed'))}
                    </p>
                  )}

                  <Button
                    type="submit"
                    loading={status === 'sending'}
                    className="w-full"
                    data-testid="contact-submit"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    {t('contact.send')}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
