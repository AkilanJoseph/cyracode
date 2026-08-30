import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, RefreshCw, Check, MapPin, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ProgressSteps from '../components/common/ProgressSteps'
import Button from '../components/common/Button'
import MapPicker from '../components/MapPicker'
import { AddressStep, MobileStep, validateAddress } from './RegisterTraditional'
import { registration } from '../services/api'

const MAX_REGENERATIONS = 10

export default function RegisterAutoGenerate() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  // AC 6.17: single idempotency key per form session prevents rapid duplicate submissions
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random()}`
  )

  const [coords, setCoords] = useState(null)
  const [code, setCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [regenCount, setRegenCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', street_address: '', building_name: '', flat_number: '', plot_number: '',
    floor_unit: '', postal_code: '', digi_pin: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})
  const [mobile, setMobile] = useState('')
  const [verified, setVerified] = useState(false)

  const STEPS = [t('register.step_location_code'), t('register.step_address'), t('register.step_verify')]

  const generate = async (lat, lng) => {
    setGenerating(true)
    try {
      const { data } = await registration.generateCode(lat, lng)
      setCode(data.code)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.generate_failed'))
    } finally {
      setGenerating(false)
    }
  }

  const handleLocation = (lat, lng) => {
    setCoords({ lat, lng })
    setRegenCount(0)
    generate(lat, lng)
  }

  const regenerate = () => {
    if (!coords) return
    if (regenCount >= MAX_REGENERATIONS) { toast.error(t('register.regen_limit')); return }
    setRegenCount((c) => c + 1)
    generate(coords.lat, coords.lng)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success(t('register.code_copied'))
    setTimeout(() => setCopied(false), 1500)
  }

  const nextFromStep1 = () => {
    if (!coords) return toast.error(t('errors.select_location'))
    if (!code) return toast.error(t('register.generate_first'))
    setStep(2)
  }

  const nextFromStep2 = () => {
    const errors = validateAddress(address)
    setAddressErrors(errors)
    if (Object.keys(errors).length) return toast.error(t('errors.fix_fields'))
    setStep(3)
  }

  const submit = async () => {
    if (!verified) return toast.error(t('errors.verify_mobile'))
    setSubmitting(true)
    try {
      const payload = {
        name: code,
        latitude: coords.lat,
        longitude: coords.lng,
        country: address.country,
        country_code: address.country_code === 'OTHER' ? 'XX' : address.country_code,
        state: address.state || null,
        district: address.district || null,
        city: address.city || null,
        area: address.area || null,
        town: address.town || null,
        road_name: address.road_name || null,
        street_address: address.street_address,
        building_name: address.building_name || null,
        flat_number: address.flat_number || null,
        plot_number: address.plot_number || null,
        floor_unit: address.floor_unit || null,
        postal_code: address.postal_code,
        digi_pin: address.digi_pin || null,
        landmark: address.landmark || null,
        verified_mobile: mobile,
      }
      const { data } = await registration.registerAutoGenerate(payload, idempotencyKeyRef.current)
      navigate('/confirmation', { state: { record: data, mode: 'auto_generate' } })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.register_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
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
          <span className="text-muted mx-2">/</span>
          <span className="text-sm text-muted">{t('nav.auto_generate')}</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">{t('register.title_auto')}</h1>
          <p className="text-muted mt-1">{t('common.step_of', { current: step, total: 3, name: STEPS[step - 1] })}</p>
        </div>
        <ProgressSteps steps={STEPS} current={step} />

        <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8 mt-6">
          {step === 1 && (
            <div className="space-y-5">
              <MapPicker markerPosition={coords} onLocationSelect={handleLocation} />

              <div className="pt-2">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  {t('register.generated_code_label')}
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={generating ? t('register.generating') : code}
                    placeholder={t('register.code_placeholder')}
                    className="flex-1 px-3.5 py-2.5 text-sm border border-border rounded-xl bg-surface font-mono tracking-widest text-ink outline-none"
                  />
                  <button
                    onClick={copyCode}
                    disabled={!code}
                    className="px-3.5 border border-border rounded-xl hover:bg-surface disabled:opacity-40 transition-colors"
                    title={t('register.copy_code')}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted" />}
                  </button>
                </div>
                {code && (
                  <button
                    onClick={regenerate}
                    disabled={generating || regenCount >= MAX_REGENERATIONS}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t('register.regenerate', { n: MAX_REGENERATIONS - regenCount })}
                  </button>
                )}
              </div>

              <Button onClick={nextFromStep1} className="w-full">{t('common.continue')}</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <AddressStep address={address} setAddress={setAddress} errors={addressErrors} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
                <Button onClick={nextFromStep2} className="flex-1">{t('common.continue')}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <MobileStep mobile={mobile} setMobile={setMobile} verified={verified} setVerified={setVerified} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">{t('common.back')}</Button>
                <Button onClick={submit} loading={submitting} disabled={!verified} className="flex-1">
                  {t('register.complete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
