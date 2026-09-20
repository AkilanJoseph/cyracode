import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Sparkles, RefreshCw, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ProgressSteps from '../components/common/ProgressSteps'
import Button from '../components/common/Button'
import MapPicker from '../components/MapPicker'
import Header from '../components/common/Header'
import { AddressStep, validateAddress } from './RegisterTraditional'
import { registration } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

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
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState('')
  const [generating, setGenerating] = useState(false)

  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', avenue_name: '', street_address: '', building_name: '', flat_number: '', suite_name: '', plot_number: '',
    floor_unit: '', postal_code: '', po_box: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})

  const STEPS = [t('register.step_personalized_code'), t('register.step_address')]

  // "Auto Generate My Code": build 10 personalized, available suggestions.
  // The backend combines the logged-in user's profile details with multiple
  // themes and only returns names that pass the live database availability check.
  const generateNames = async () => {
    setGenerating(true)
    try {
      const { data } = await registration.suggestNames()
      const names = data.names || []
      setSuggestions(names)
      if (selected && !names.some((s) => s.name === selected)) setSelected('')
    } catch (err) {
      // slowapi rate-limit responses carry `error` (not `detail`), so surface
      // both to avoid showing the generic "Could not generate code" on a 429.
      toast.error(err.response?.data?.detail || err.response?.data?.error || t('errors.generate_failed'))
    } finally {
      setGenerating(false)
    }
  }

  const handleLocation = (lat, lng) => {
    setCoords({ lat, lng })
  }

  const nextFromStep1 = () => {
    if (!selected) return toast.error(t('register.select_suggestion_first'))
    if (!coords) return toast.error(t('errors.select_location'))
    setStep(2)
  }

  const nextFromStep2 = () => {
    const errors = validateAddress(address)
    setAddressErrors(errors)
    if (Object.keys(errors).length) return toast.error(t('errors.fix_fields'))
    submit()
  }

  const submit = async () => {
    if (!selected) return toast.error(t('register.select_suggestion_first'))
    setSubmitting(true)
    try {
      const payload = {
        name: selected,
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
        avenue_name: address.avenue_name || null,
        street_address: address.street_address,
        building_name: address.building_name || null,
        flat_number: address.flat_number || null,
        suite_name: address.suite_name || null,
        plot_number: address.plot_number || null,
        floor_unit: address.floor_unit || null,
        postal_code: address.postal_code,
        po_box: address.po_box || null,
        landmark: address.landmark || null,
      }
      const { data } = await registration.registerPersonalized(payload, idempotencyKeyRef.current)
      navigate('/confirmation', { state: { record: data, mode: 'auto_generate' } })
    } catch (err) {
      if (err.response?.status === 409) {
        // The database re-check found the name was claimed while the user was
        // filling in the address — never save it; send them back to pick another.
        setStep(1)
        setSelected('')
        toast.error(t('errors.name_no_longer_available'))
      } else {
        toast.error(apiErrorMessage(err, t('errors.register_failed')))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header showBack breadcrumb={t('nav.auto_generate')} maxWidth="max-w-2xl" />

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">{t('register.title_auto')}</h1>
          <p className="text-muted mt-1">{t('common.step_of', { current: step, total: 2, name: STEPS[step - 1] })}</p>
        </div>
        <ProgressSteps steps={STEPS} current={step} />

        <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8 mt-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Auto Generate My Code */}
              <div className="rounded-2xl border border-primary/20 bg-primary-light/40 p-5">
                <p className="text-sm font-semibold text-ink">{t('register.auto_generate_title')}</p>
                <p className="text-xs text-muted mt-0.5 mb-4">{t('register.auto_generate_hint')}</p>
                <Button onClick={generateNames} loading={generating} className="w-full" data-testid="auto-generate-btn">
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> {t('register.auto_generate_btn')}
                </Button>
              </div>

              {/* Personalized suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{t('register.suggestions_title')}</p>
                    <button
                      onClick={generateNames}
                      disabled={generating}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('register.generate_more')}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-0.5 mb-3">{t('register.suggestions_hint')}</p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {suggestions.map((s) => {
                      const active = selected === s.name
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setSelected(s.name)}
                          aria-pressed={active}
                          data-testid={`suggestion-${s.name}`}
                          className={`text-left border rounded-xl px-3.5 py-3 transition-all ${
                            active
                              ? 'border-primary bg-primary-light ring-2 ring-primary/20'
                              : 'border-border bg-white hover:border-primary/40'
                          }`}
                        >
                          <p className="font-mono font-semibold text-ink leading-tight break-all">{s.name}</p>
                          <p className={`text-[11px] mt-0.5 ${active ? 'text-primary' : 'text-muted'}`}>{s.category}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {generating && suggestions.length === 0 && (
                <p className="text-sm text-muted">{t('register.suggestions_loading')}</p>
              )}
              {!generating && suggestions.length === 0 && (
                <p className="text-sm text-muted">{t('register.suggestions_empty')}</p>
              )}

              {/* Location */}
              <MapPicker markerPosition={coords} onLocationSelect={handleLocation} />

              <Button
                onClick={nextFromStep1}
                disabled={!coords}
                title={!coords ? t('errors.select_location') : undefined}
                className="w-full"
              >
                {t('common.continue')}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <p className="text-sm text-ink">
                  <span className="font-semibold text-emerald-700">{t('register.chosen_label')}:</span>{' '}
                  <span className="font-mono font-semibold text-ink">{selected}</span>
                </p>
              </div>
              <AddressStep address={address} setAddress={setAddress} errors={addressErrors} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
                <Button onClick={nextFromStep2} loading={submitting} className="flex-1">{t('register.complete')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}