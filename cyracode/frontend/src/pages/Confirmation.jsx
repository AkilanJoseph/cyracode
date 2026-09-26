import { useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2, Download, Mail, Copy, MessageCircle,
  ArrowRight, Facebook,
} from 'lucide-react'
import Button from '../components/common/Button'
import Header from '../components/common/Header'

function Confetti() {
  const colors = ['#069494', '#047878', '#2DD4BF', '#34D399', '#60A5FA', '#A78BFA']
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 36 }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 2.8) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i * 0.07) % 2}s`,
            width: i % 3 === 0 ? '6px' : '9px',
            height: i % 3 === 0 ? '6px' : '4px',
          }}
        />
      ))}
    </div>
  )
}

export default function Confirmation() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const qrRef = useRef(null)

  const record = state?.record
  if (!record) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted">{t('confirmation.no_data')}</p>
        <Button onClick={() => navigate('/')}>{t('common.go_home')}</Button>
      </div>
    )
  }

    // AC 4.6: QR encodes an OpenStreetMap URL for proper scanning behavior
    const qrValue = `https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=16/${record.latitude}/${record.longitude}`

  const addressLine = [
    record.flat_number,
    record.suite_name,
    record.plot_number,
    record.building_name,
    record.street_address,
    record.avenue_name,
    record.road_name,
    record.area,
    record.town,
    record.landmark,
    record.city,
    record.district,
    record.state,
    record.postal_code,
    record.country,
  ].filter(Boolean).join(', ')

  const shareLink = `${window.location.origin}/search?q=${encodeURIComponent(record.code_name)}`
  const shareText = `${t('confirmation.share_text', { code: record.code_name })} ${shareLink}`

  // AC 4.7 / AC 6.10: prefer WebP for smaller file size; fall back to PNG
  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    const [mime, ext] = supportsWebP ? ['image/webp', 'webp'] : ['image/png', 'png']
    const a = document.createElement('a')
    a.href = canvas.toDataURL(mime)
    a.download = `CyraCode_${record.code_name}_${Date.now()}.${ext}`
    a.click()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    toast.success(t('confirmation.link_copied'))
  }

  // Copy the registered address using the Clipboard API, falling back to a
  // hidden textarea + execCommand for browsers/contexts without clipboard access.
  const copyAddress = async () => {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = addressLine
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '-1000px'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ta.setSelectionRange(0, ta.value.length)
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }

    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(addressLine)
        ok = true
      } else {
        ok = fallback()
      }
    } catch {
      ok = fallback()
    }

    if (ok) toast.success(t('confirmation.address_copied'))
    else toast.error(t('confirmation.copy_failed'))
  }

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  const shareEmail = () => {
    const subject = `${t('confirmation.email_subject')} ${record.code_name}`
    const body = `${t('confirmation.email_body', { code: record.code_name })}\n${addressLine}\n${shareLink}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  // AC 4.8: Facebook share
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-surface">
      <Confetti />

      <Header showBack maxWidth="max-w-2xl" />

      <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 animate-checkmark mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-ink">{t('confirmation.congrats')}</h1>
          <p className="text-muted mt-2">{t('confirmation.subtitle')}</p>
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-card p-6">
          <div className="text-center pb-6 border-b border-border">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">{t('confirmation.your_code')}</p>
            <p className="text-4xl font-bold font-mono text-primary tracking-wider break-all">
              {record.code_name}
            </p>
          </div>

          <div ref={qrRef} className="flex justify-center py-6 border-b border-border">
            <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
              <QRCodeCanvas value={qrValue} size={160} fgColor="#069494" level="H" />
            </div>
          </div>

          <div className="py-5 border-b border-border space-y-2">
            <div className="flex gap-3 items-start">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide w-24 shrink-0 pt-0.5">{t('confirmation.address_label')}</span>
              <span className="text-sm text-ink leading-relaxed flex-1 break-words max-w-xs">{addressLine}</span>
              <button
                type="button"
                onClick={copyAddress}
                aria-label={t('confirmation.copy_address')}
                className="shrink-0 p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary-light transition-colors"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex gap-3">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide w-24 shrink-0 pt-0.5">{t('confirmation.coords_label')}</span>
              <span className="text-sm font-mono text-muted">
                {Number(record.latitude).toFixed(6)}, {Number(record.longitude).toFixed(6)}
              </span>
            </div>
          </div>

          <div className="pt-5">
            <Button onClick={downloadQR} variant="secondary" className="w-full mb-3" size="md">
              <Download className="w-4 h-4" /> {t('confirmation.download_qr')}
            </Button>

            {/* AC 4.8: full share sheet — WhatsApp, Email, Facebook, Copy */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500', action: shareWhatsApp },
                { label: t('confirmation.share_email'), icon: Mail, color: 'text-blue-500', action: shareEmail },
                { label: 'Facebook', icon: Facebook, color: 'text-blue-600', action: shareFacebook },
                { label: t('confirmation.copy_link'), icon: Copy, color: 'text-muted', action: copyLink },
              ].map(({ label, icon: Icon, color, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary-light transition-all"
                >
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-medium text-muted text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Link to="/dashboard">
            <Button className="w-full" size="md">
              {t('confirmation.go_dashboard')} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
