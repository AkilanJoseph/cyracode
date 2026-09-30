import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MapPin, Loader2, Eye, Pencil, Trash2, X, AlertTriangle, CheckCircle2, Sparkles, Zap, Copy, Check, Download, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas } from 'qrcode.react'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import MapPicker from '../components/MapPicker'
import Header from '../components/common/Header'
import Footer from '../components/common/Footer'
import { APP_MAX_WIDTH, APP_PADDING_Y } from '../lib/layout'
import { AddressStep, validateAddress } from './RegisterTraditional'
import { registration } from '../services/api'
import { apiErrorMessage } from '../utils/errors'
import { cyraCodeQrValue } from '../utils/qrcode'

// Standard CyraCode address display order (most specific → broadest).
export const ADDRESS_FIELD_ORDER = [
  'plot_number',
  'building_name',
  'floor_unit',
  'flat_number',
  'suite_name',
  'street_address',
  'avenue_name',
  'road_name',
  'po_box',
  'landmark',
  'area',
  'town',
  'city',
  'postal_code',
  'district',
  'state',
  'country',
]

// Build a single human-readable address line from a CyraCode record.
// Only populated fields are emitted, each value is trimmed, and parts are
// joined with ", " so punctuation stays clean (no space before a comma and no
// double/trailing commas when optional fields are empty).
export function formatAddress(rec) {
  return ADDRESS_FIELD_ORDER.map((key) => {
    const raw = rec?.[key]
    if (raw === null || raw === undefined) return ''
    const value = String(raw).trim()
    if (!value) return ''
    return key === 'po_box' ? `P.O. Box ${value}` : value
  })
    .filter(Boolean)
    .join(', ')
}

// Resolve the state ISO code so the India/US state dropdown highlights the
// saved value. Matches by name and by ISO code (e.g. a record storing "CA").
export async function resolveStateIso(countryCode, stateName) {
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

// Whether a code matches the search box. Matches the name and the address as it
// is displayed on the tile, so a query finds a code by city or country without
// the user having to know its exact name. Scoped to this user's own codes —
// global lookup across every CyraCode already lives on /search.
export function matchesQuery(rec, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  return [rec?.code_name, formatAddress(rec)].some(
    (value) => value && String(value).toLowerCase().includes(q)
  )
}

export default function ManageCyraCodes() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Tile list
  const [codes, setCodes] = useState([])
  const [loadingCodes, setLoadingCodes] = useState(true)
  const [query, setQuery] = useState('')

  // View / remove modals
  const [viewing, setViewing] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const qrRef = useRef(null)
  const [removing, setRemoving] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  // Edit flow
  const [editing, setEditing] = useState(null)
  const [step, setStep] = useState(1)
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', avenue_name: '', street_address: '', building_name: '', flat_number: '', suite_name: '', plot_number: '',
    floor_unit: '', postal_code: '', po_box: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const clearFieldError = (field) =>
    setAddressErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })

  // Friendly display label for a code type. Codes from the "Register with
  // Custom Name" flow are stored as "traditional" but shown as "Customized".
  const typeLabel = (type) => (type === 'traditional' ? t('edit.type_customized') : type)

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

  // Derived per render from the already-loaded list, so typing filters instantly
  // and never re-queries or resets the tiles.
  const visibleCodes = codes.filter((rec) => matchesQuery(rec, query))

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
    prefill.avenue_name = rec.avenue_name || ''
    prefill.street_address = rec.street_address || ''
    prefill.building_name = rec.building_name || ''
    prefill.flat_number = rec.flat_number || ''
    prefill.suite_name = rec.suite_name || ''
    prefill.plot_number = rec.plot_number || ''
    prefill.floor_unit = rec.floor_unit || ''
    prefill.postal_code = rec.postal_code || ''
    prefill.po_box = rec.po_box || ''
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

  const openView = (rec) => {
    setCopied(false)
    setViewing(rec)
  }

  // Copy the formatted address using the Clipboard API, falling back to a
  // Prefer WebP for a smaller file; fall back to PNG where toDataURL does not
  // support it. Mirrors the confirmation screen's download.
  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    const [mime, ext] = supportsWebP ? ['image/webp', 'webp'] : ['image/png', 'png']
    const a = document.createElement('a')
    a.href = canvas.toDataURL(mime)
    a.download = `CyraCode_${viewing.code_name}_${Date.now()}.${ext}`
    a.click()
  }

  // hidden textarea + execCommand for browsers/contexts without clipboard access.
  const writeClipboard = async (text) => {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
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

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
      return fallback()
    } catch {
      return fallback()
    }
  }

  const copyAddress = async (text) => {
    if (await writeClipboard(text)) {
      setCopied(true)
      toast.success(t('edit.address_copied'))
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error(t('edit.copy_failed'))
    }
  }

  // Tile copy: name and display address together, each on its own labelled line
  // so the pasted text stays readable outside the app.
  const copyCodeDetails = async (rec) => {
    const text = [
      `${t('edit.cyracode_name')}: ${rec.code_name}`,
      `${t('edit.address')}: ${formatAddress(rec)}`,
    ].join('\n')

    if (await writeClipboard(text)) {
      setCopiedId(rec.id)
      toast.success(t('edit.details_copied'))
      // Only clear if the user has not started copying a different tile.
      setTimeout(() => setCopiedId((cur) => (cur === rec.id ? null : cur)), 2000)
    } else {
      toast.error(t('edit.details_copy_failed'))
    }
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
      {editing && step === 1 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('edit.name_immutable')}</span>
        </div>
      )}
      {/* The pin is adjusted on the first screen, so the hint belongs above the
          map rather than on the address form. */}
      {editing && step === 1 && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {t('edit.pick_hint', { name: editing.code_name })}
        </div>
      )}
      {step === 1 && (
        <div className="space-y-5">
          <MapPicker
            key={editing.id}
            markerPosition={coords}
            onLocationSelect={(lat, lng) => setCoords({ lat, lng })}
            height="380px"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <AddressStep address={address} setAddress={setAddress} errors={addressErrors} clearError={clearFieldError} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
            <Button onClick={save} loading={saving} className="flex-1">{t('edit.save_changes')}</Button>
          </div>
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
          {t('edit.code_type')}: {typeLabel(rec.code_type)}
        </span>
      </div>
      <p className="text-sm text-muted leading-snug line-clamp-2">{formatAddress(rec)}</p>
      <p className="text-xs font-mono text-muted/70">
        {Number(rec.latitude).toFixed(6)}, {Number(rec.longitude).toFixed(6)}
      </p>
      {/* Same two-row layout at every width: three equal controls on top, Remove
          spanning the full width below, which keeps the destructive action apart. */}
      <div className="grid grid-cols-3 gap-2 mt-auto pt-1">
        <Button variant="secondary" size="sm" onClick={() => copyCodeDetails(rec)}>
          {copiedId === rec.id
            ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          {t('edit.copy')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openView(rec)}>
          <Eye className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.view')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => startEdit(rec)}>
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.edit')}
        </Button>
        <Button variant="danger" size="sm" className="col-span-3" onClick={() => handleRemoveClick(rec)}>
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('edit.remove')}
        </Button>
      </div>
    </div>
  )

  const viewRows = viewing
    ? [
        { label: t('register.plot_number'), value: viewing.plot_number },
        { label: t('register.building'), value: viewing.building_name },
        { label: t('register.floor'), value: viewing.floor_unit },
        { label: t('register.flat_number'), value: viewing.flat_number },
        { label: t('register.suite_name'), value: viewing.suite_name },
        { label: t('register.street'), value: viewing.street_address },
        { label: t('register.avenue_name'), value: viewing.avenue_name },
        { label: t('register.road_name'), value: viewing.road_name },
        { label: t('register.po_box'), value: viewing.po_box },
        { label: t('register.landmark'), value: viewing.landmark },
        { label: t('register.area'), value: viewing.area },
        { label: t('register.town'), value: viewing.town },
        { label: t('register.city'), value: viewing.city },
        { label: t('register.postal_other'), value: viewing.postal_code },
        { label: t('register.district'), value: viewing.district },
        { label: t('register.state'), value: viewing.state },
        { label: t('register.country'), value: viewing.country },
      ].filter((r) => r.value)
    : []

  return (
    <div className="min-h-screen bg-surface">
      <Header showBack breadcrumb={t('edit.title')} maxWidth={APP_MAX_WIDTH} />

      <div id="main-content" className={`${APP_MAX_WIDTH} mx-auto px-4 ${APP_PADDING_Y}`}>
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
          <div className="bg-white rounded-3xl border border-border shadow-card py-16 px-4 text-center">
            <MapPin className="w-10 h-10 text-muted/40 mx-auto mb-3" aria-hidden="true" />
            <p className="text-muted">{t('edit.no_codes')}</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Button onClick={() => navigate('/register/traditional')}>
                <Sparkles className="w-4 h-4" aria-hidden="true" /> {t('edit.register_first')}
              </Button>
              <Button onClick={() => navigate('/register/auto-generate')}>
                <Zap className="w-4 h-4" aria-hidden="true" /> {t('edit.register_auto')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Only shown once the user has at least one code — with none, the
                empty state above already prompts them to register. */}
            <div className="relative">
              <Search
                className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('edit.search_placeholder')}
                aria-label={t('edit.search_placeholder')}
                data-testid="manage-search"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-border rounded-xl
                  bg-white outline-none transition-all
                  focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {visibleCodes.length === 0 ? (
              <div className="bg-white rounded-3xl border border-border shadow-card py-12 px-4 text-center">
                <Search className="w-10 h-10 text-muted/40 mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted">{t('edit.search_no_results')}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {visibleCodes.map(renderTile)}
              </div>
            )}
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
              <div ref={qrRef} data-testid="view-qr" className="flex justify-center">
                {/* Same encoder and payload as the confirmation screen, so a code
                    scans identically wherever it is shown. */}
                <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
                  <QRCodeCanvas value={cyraCodeQrValue(viewing)} size={160} fgColor="#069494" level="H" />
                </div>
              </div>
              <div data-testid="view-qr-download">
                <Button variant="secondary" className="w-full" size="sm" onClick={downloadQR}>
                  <Download className="w-4 h-4" aria-hidden="true" /> {t('edit.download_qr')}
                </Button>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">{t('edit.address')}</p>
                  {/* Icon only; the accessible name carries the action, and the
                      copy is confirmed by a toast. */}
                  <button
                    type="button"
                    onClick={() => copyAddress(formatAddress(viewing))}
                    aria-label={t('edit.copy_address')}
                    title={t('edit.copy_address')}
                    data-testid="copy-address"
                    className="p-1 -mr-1 rounded-lg text-muted hover:text-primary
                      hover:bg-primary-light transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <p data-testid="view-address" className="text-sm text-ink leading-relaxed break-words">{formatAddress(viewing)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{t('edit.coords')}</p>
                  <p className="text-sm font-mono text-muted break-all">
                    {Number(viewing.latitude).toFixed(6)}, {Number(viewing.longitude).toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{t('edit.code_type')}</p>
                  <p className="text-sm text-ink capitalize">{typeLabel(viewing.code_type)}</p>
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

    <Footer maxWidth={APP_MAX_WIDTH} />
    </div>
  )
}