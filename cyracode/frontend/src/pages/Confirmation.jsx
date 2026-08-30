import { useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2, Download, Share2, Mail, Copy, MessageCircle,
  MapPin, ArrowRight, ArrowLeft, Facebook, UserCircle, Truck, Users,
} from 'lucide-react'
import Button from '../components/common/Button'

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
    record.plot_number,
    record.building_name,
    record.street_address,
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

  // AC 4.9: Next steps
  const nextSteps = [
    { icon: UserCircle, title: t('confirmation.next_profile_title'), desc: t('confirmation.next_profile_desc') },
    { icon: Truck, title: t('confirmation.next_delivery_title'), desc: t('confirmation.next_delivery_desc') },
    { icon: Users, title: t('confirmation.next_share_title'), desc: t('confirmation.next_share_desc') },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <Confetti />

      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 shrink-0" aria-label={t('nav.brand')}>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink">{t('nav.brand')}</span>
          </button>
        </div>
      </nav>

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
            <div className="flex gap-3">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide w-24 shrink-0 pt-0.5">{t('confirmation.address_label')}</span>
              <span className="text-sm text-ink leading-relaxed">{addressLine}</span>
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

        {/* AC 4.9: Next Steps */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">{t('confirmation.next_steps')}</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {nextSteps.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-border p-4">
                <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="text-xs text-muted mt-0.5 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link to="/dashboard">
            <Button className="w-full" size="md">
              {t('confirmation.go_dashboard')} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/search">
            <Button variant="secondary" className="w-full" size="md">
              <Share2 className="w-4 h-4" /> {t('confirmation.search_codes')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
