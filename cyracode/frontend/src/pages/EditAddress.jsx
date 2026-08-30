import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MapPin, ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import MapPicker from '../components/MapPicker'
import { AddressStep, validateAddress } from './RegisterTraditional'
import { registration } from '../services/api'

const SELECT_CLS =
  'w-full px-3.5 py-2.5 text-sm border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-ink'

export default function EditAddress() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [codes, setCodes] = useState([])
  const [loadingCodes, setLoadingCodes] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState(null)

  const [step, setStep] = useState(1)
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', street_address: '', building_name: '', flat_number: '', plot_number: '',
    floor_unit: '', postal_code: '', digi_pin: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await registration.getMyCodes()
        setCodes(data || [])
      } catch {
        toast.error(t('errors.login_failed'))
      } finally {
        setLoadingCodes(false)
      }
    })()
  }, [t])

  const handleSelect = async (id) => {
    setSelectedId(id)
    if (!id) {
      setSelected(null)
      setStep(1)
      return
    }
    const rec = codes.find((c) => c.id === id)
    if (!rec) return

    // Load the (mostly immutable) country so the state dropdown can resolve.
    const prefill = { ...address }
    prefill.country_code = rec.country_code === 'XX' ? 'OTHER' : rec.country_code
    prefill.country = rec.country || ''
    prefill.state = rec.state || ''
    prefill.district = rec.district || ''
    prefill.city = rec.city || ''
    prefill.area = rec.area || ''
    prefill.town = rec.town || ''
    prefill.road_name = rec.road_name || ''
    prefill.street_address = rec.street_address || ''
    prefill.building_name = rec.building_name || ''
    prefill.flat_number = rec.flat_number || ''
    prefill.plot_number = rec.plot_number || ''
    prefill.floor_unit = rec.floor_unit || ''
    prefill.postal_code = rec.postal_code || ''
    prefill.digi_pin = rec.digi_pin || ''
    prefill.landmark = rec.landmark || ''
    prefill.stateIso = ''

    setSelected(rec)
    setCoords({ lat: Number(rec.latitude), lng: Number(rec.longitude) })
    setAddress(prefill)
    setAddressErrors({})
    setStep(1)
  }

  // Resolve the state ISO code so the India/US state dropdown highlights it.
  // Matches by ISO code too (e.g. a record storing "CA" instead of "California").
  const resolveStateIso = async (countryCode, stateName) => {
    if (!countryCode || !stateName || ['US', 'IN'].indexOf(countryCode) === -1) return ''
    try {
      const mod = await import('country-state-city/lib/state')
      const states = mod.default.getStatesOfCountry(countryCode)
      const q = stateName.toLowerCase()
      const match =
        states.find((s) => s.name.toLowerCase() === q) ||
        states.find((s) => s.isoCode.toLowerCase() === q) ||
        states.find((s) => q.includes(s.name.toLowerCase())) ||
        states.find((s) => s.name.toLowerCase().includes(q))
      return match ? match.isoCode : ''
    } catch {
      return ''
    }
  }

  useEffect(() => {
    if (!selected) return
    let active = true
    resolveStateIso(address.country_code, selected.state).then((iso) => {
      if (active && iso) setAddress((a) => ({ ...a, stateIso: iso }))
    })
    return () => { active = false }
  }, [selected, address.country_code])

  const handleLocationSelect = (lat, lng) => {
    setCoords({ lat, lng })
  }

  const nextFromStep1 = () => {
    if (!coords) return toast.error(t('errors.select_location'))
    setStep(2)
  }

  const save = async () => {
    const errors = validateAddress(address)
    setAddressErrors(errors)
    if (Object.keys(errors).length) return toast.error(t('errors.fix_fields'))
    if (!coords) return toast.error(t('errors.select_location'))

    setSaving(true)
    try {
      const payload = {
        latitude: coords.lat,
        longitude: coords.lng,
        country: address.country || selected.country || '',
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
      }
      await registration.updateMyCode(selected.id, payload)
      toast.success(t('edit.saved_success'))
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('edit.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const renderPick = () => (
    <div className="space-y-5">
      {loadingCodes ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted">{t('edit.no_codes')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/register/traditional')}>
            {t('edit.register_first')}
          </Button>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              {t('edit.select_label')}
            </label>
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">{t('edit.select_placeholder')}</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>{c.code_name}</option>
              ))}
            </select>
            {selected && (
              <p className="mt-2 text-sm text-gray-500">
                {[
                  selected.flat_number, selected.plot_number, selected.building_name,
                  selected.street_address, selected.road_name, selected.area, selected.town,
                  selected.city, selected.state, selected.postal_code, selected.country,
                ].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{t('edit.name_immutable')}</span>
          </div>
        </>
      )}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t('edit.editing_label')}: <span className="font-mono font-semibold text-ink">{selected.code_name}</span></p>
        <button
          onClick={() => { setSelectedId(''); setSelected(null); setStep(1) }}
          className="text-xs text-primary hover:underline"
        >
          {t('edit.change_code')}
        </button>
      </div>
      <MapPicker
        key={selected.id}
        markerPosition={coords}
        onLocationSelect={handleLocationSelect}
        height="380px"
      />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <Input label="Latitude" value={coords ? coords.lat.toFixed(6) : ''} placeholder="Select location on map" disabled helperText={t('edit.coord_hint')} />
        <Input label="Longitude" value={coords ? coords.lng.toFixed(6) : ''} placeholder="Select location on map" disabled helperText={t('edit.coord_hint')} />
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => { setSelectedId(''); setSelected(null); setStep(1) }} className="flex-1">{t('common.back')}</Button>
        <Button onClick={nextFromStep1} disabled={!coords} className="flex-1">{t('common.continue')}</Button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      <AddressStep address={address} setAddress={setAddress} errors={addressErrors} />
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
        <Button onClick={save} loading={saving} className="flex-1">{t('edit.save_changes')}</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface">
      <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
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
              <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-ink">{t('nav.brand')}</span>
          </button>
          <span className="text-muted mx-2">/</span>
          <span className="text-sm text-muted">{t('edit.title')}</span>
        </div>
      </nav>

      <div id="main-content" className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">{t('edit.title')}</h1>
          <p className="text-muted mt-1">{t('edit.subtitle')}</p>
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8">
          {step === 1 && (
            selected && coords ? renderStep1() : renderPick()
          )}
          {step === 2 && renderStep2()}
        </div>

        {selected && step === 1 && (
          <div className="mt-6 flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {t('edit.pick_hint', { name: selected.code_name })}
          </div>
        )}
      </div>
    </div>
  )
}
