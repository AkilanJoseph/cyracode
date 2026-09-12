import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MapPin, Loader2, Eye, Pencil, Trash2, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import MapPicker from '../components/MapPicker'
import BackButton from '../components/common/BackButton'
import { AddressStep, validateAddress } from './RegisterTraditional'
import { registration } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

// Build a single human-readable address line from a CyraCode record.
function formatAddress(rec) {
  return [
    rec.flat_number,
    rec.plot_number,
    rec.building_name,
    rec.street_address,
    rec.road_name,
    rec.area,
    rec.town,
    rec.landmark,
    rec.city,
    rec.district,
    rec.state,
    rec.postal_code,
    rec.country,
  ].filter(Boolean).join(', ')
}

// Resolve the state ISO code so the India/US state dropdown highlights the
// saved value. Matches by name and by ISO code (e.g. a record storing "CA").
async function resolveStateIso(countryCode, stateName) {
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

export default function ManageCyraCodes() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Tile list
  const [codes, setCodes] = useState([])
  const [loadingCodes, setLoadingCodes] = useState(true)

  // View / remove modals
  const [viewing, setViewing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  // Edit flow
  const [editing, setEditing] = useState(null)
  const [step, setStep] = useState(1)
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', street_address: '', building_name: '', flat_number: '', plot_number: '',
    floor_unit: '', postal_code: '', digi_pin: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const loadCodes = useCallback(async () => {
    setLoadingCodes(true)
    try {
      const { data } = await registration.getMyCodes()
      setCodes(data || [])
    } catch {
      toast.error(t('errors.login_failed'))
    } finally {
      setLoadingCodes(false)
    }
  }, [t])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  const startEdit = (rec) => {
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

    setEditing(rec)
    setCoords({ lat: Number(rec.latitude), lng: Number(rec.longitude) })
    setAddress(prefill)
    setAddressErrors({})
    setStep(1)
  }

  // Highlight the saved state in the dropdown once its ISO code is resolved.
  useEffect(() => {
    if (!editing) return
    let active = true
    resolveStateIso(address.country_code, editing.state).then((iso) => {
      if (active && iso) setAddress((a) => ({ ...a, stateIso: iso }))
    })
    return () => { active = false }
  }, [editing, address.country_code])

  const cancelEdit = () => {
    setEditing(null)
    setStep(1)
  }

  const nextFromStep1 = () => {
    if (!coords) return toast.error(t('errors.select_location'))
    setStep(2)
  }

  // AC: save only after validation; backend enforces that this user owns the code.
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
        country: address.country || editing.country || '',
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
      await registration.updateMyCode(editing.id, payload)
      toast.success(t('edit.saved_success'))
      cancelEdit()
      await loadCodes()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('edit.save_failed')))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveClick = (rec) => {
    setRemoving(rec)
  }

  const confirmRemove = async () => {
    if (!removing) return
    setRemovingId(removing.id)
    try {
      await registration.deleteMyCode(removing.id)
      toast.success(t('edit.removed_success'))
      setRemoving(null)
      await loadCodes()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('edit.remove_failed')))
    } finally {
      setRemovingId(null)
    }
  }

  const renderEdit = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t('edit.editing_label')}: <span className="font-mono font-semibold text-ink">{editing.code_name}</span>
        </p>
        <button onClick={cancelEdit} className="text-xs text-primary hover:underline shrink-0">
          {t('edit.cancel')}
        </button>
      </div>
      {step === 1 && (
        <div className="space-y-5">
          <MapPicker
            key={editing.id}
            markerPosition={coords}
            onLocationSelect={(lat, lng) => setCoords({ lat, lng })}
            height="380px"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" value={coords ? coords.lat.toFixed(6) : ''} placeholder="Select location on map" disabled helperText={t('edit.coord_hint')} />
            <Input label="Longitude" value={coords ? coords.lng.toFixed(6) : ''} placeholder="Select location on map" disabled helperText={t('edit.coord_hint')} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={cancelEdit} className="flex-1">{t('edit.cancel')}</Button>
            <Button onClick={nextFromStep1} disabled={!coords} className="flex-1">{t('common.continue')}</Button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5">
          <AddressStep address={address} setAddress={setAddress} errors={addressErrors} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
            <Button onClick={save} loading={saving} className="flex-1">{t('edit.save_changes')}</Button>
          </div>
        </div>
      )}
      {editing && step === 1 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('edit.name_immutable')}</span>
        </div>
      )}
    </div>
  )

  const renderTile = (rec) => (
    <div key={rec.id} data-testid={`code-tile-${rec.id}`} className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col gap-3 transition-all duration-300 hover:border-primary/40 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">CyraCode</p>
          <h2 className="text-lg font-bold text-ink font-mono leading-tight break-all">{rec.code_name}</h2>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary-light px-2.5 py-1 rounded-full shrink-0 capitalize">
          {t('edit.code_type')}: {rec.code_type}
        </span>
      </div>
      <p className="text-sm text-muted leading-snug line-clamp-2">{formatAddress(rec)}</p>
      <p className="text-xs font-mono text-muted/70">
        {Number(rec.latitude).toFixed(6)}, {Number(rec.longitude).toFixed(6)}
      </p>
      <div className="flex gap-2 mt-auto pt-1">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setViewing(rec)}>
          <Eye className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.view')}
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => startEdit(rec)}>
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.edit')}
        </Button>
        <Button variant="danger" size="sm" className="flex-1" onClick={() => handleRemoveClick(rec)}>
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.remove')}
        </Button>
      </div>
    </div>
  )

  const viewRows = viewing
    ? [
        { label: t('register.country'), value: viewing.country },
        { label: t('register.state'), value: viewing.state },
        { label: t('register.district'), value: viewing.district },
        { label: t('register.city'), value: viewing.city },
        { label: t('register.area'), value: viewing.area },
        { label: t('register.town'), value: viewing.town },
        { label: t('register.road_name'), value: viewing.road_name },
        { label: t('register.street'), value: viewing.street_address },
        { label: t('register.building'), value: viewing.building_name },
        { label: t('register.flat_number'), value: viewing.flat_number },
        { label: t('register.plot_number'), value: viewing.plot_number },
        { label: t('register.floor'), value: viewing.floor_unit },
        { label: t('register.postal_other'), value: viewing.postal_code },
        { label: t('register.digi_pin'), value: viewing.digi_pin },
        { label: t('register.landmark'), value: viewing.landmark },
      ].filter((r) => r.value)
    : []

  return (
    <div className="min-h-screen bg-surface">
      <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <BackButton />
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

      <div id="main-content" className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">{t('edit.title')}</h1>
          <p className="text-muted mt-1">{t('edit.subtitle')}</p>
        </div>

        {editing ? (
          <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8">
            {renderEdit()}
          </div>
        ) : loadingCodes ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> {t('common.loading')}
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-border shadow-card py-16 text-center">
            <MapPin className="w-10 h-10 text-muted/40 mx-auto mb-3" aria-hidden="true" />
            <p className="text-muted">{t('edit.no_codes')}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/register/traditional')}>
              {t('edit.register_first')}
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {codes.map(renderTile)}
          </div>
        )}
      </div>

      {/* Read-only View modal */}
      {viewing && (
        <div data-testid="view-modal" className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-modal animate-slide-in overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">CyraCode</p>
                <h2 className="text-lg font-bold text-ink font-mono break-all leading-tight">{viewing.code_name}</h2>
              </div>
              <button onClick={() => setViewing(null)} aria-label={t('edit.close')} className="text-muted hover:text-ink shrink-0 ml-3">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{t('edit.address')}</p>
                <p className="text-sm text-ink leading-relaxed">{formatAddress(viewing)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{t('edit.coords')}</p>
                  <p className="text-sm font-mono text-muted break-all">
                    {Number(viewing.latitude).toFixed(6)}, {Number(viewing.longitude).toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{t('edit.code_type')}</p>
                  <p className="text-sm text-ink capitalize">{viewing.code_type}</p>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                {viewRows.map(({ label, value }) => (
                  <div key={label} className="sm:flex sm:justify-between sm:gap-4">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide sm:w-40 sm:shrink-0">{label}</p>
                    <p className="text-sm text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border">
              <Button variant="secondary" className="w-full" onClick={() => setViewing(null)}>
                {t('edit.close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removing && (
        <div data-testid="remove-modal" className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-modal animate-slide-in p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-ink">{t('edit.remove_title')}</h2>
            </div>
            <p className="text-sm text-muted leading-relaxed">{t('edit.remove_body', { name: removing.code_name })}</p>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setRemoving(null)} disabled={removingId === removing.id}>
                {t('edit.cancel')}
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmRemove} loading={removingId === removing.id}>
                <Trash2 className="w-4 h-4" aria-hidden="true" /> {t('edit.confirm_remove')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && step === 2 && (
        <div className="max-w-3xl mx-auto px-4 mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {t('edit.pick_hint', { name: editing.code_name })}
        </div>
      )}
    </div>
  )
}