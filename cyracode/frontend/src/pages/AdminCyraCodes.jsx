import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, Plus, Eye, Pencil, Trash2, RotateCcw, X, Sparkles, Zap, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import MapPicker from '../components/MapPicker'
import { AddressStep, validateAddress } from './RegisterTraditional'
import { resolveStateIso } from './ManageCyraCodes'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

function codeTypeLabel(t, type) {
  return (
    {
      traditional: t('edit.type_customized'),
      auto_generate: t('edit.type_auto_generate'),
      personalized: t('edit.type_personalized'),
    }[type] || type
  )
}

const REGISTRATION_ROUTES = {
  custom: '/register/traditional',
  auto: '/register/auto-generate',
}

const EMPTY_ADDRESS = {
  country_code: '', country: '', state: '', stateIso: '', district: '',
  city: '', area: '', town: '', road_name: '', avenue_name: '', street_address: '', building_name: '', flat_number: '', suite_name: '', plot_number: '',
  floor_unit: '', postal_code: '', po_box: '', landmark: '',
}

function RegistrationTypeModal({ onSelect, onClose }) {
  const { t } = useTranslation()
  // Icons mirror the Dashboard registration cards (App.jsx) so the two
  // registration types look identical wherever they are offered.
  const options = [
    {
      key: 'custom',
      icon: Sparkles,
      label: t('admin.code_add_custom'),
      description: t('admin.code_add_custom_desc'),
      to: REGISTRATION_ROUTES.custom,
    },
    {
      key: 'auto',
      icon: Zap,
      label: t('admin.code_add_auto'),
      description: t('admin.code_add_auto_desc'),
      to: REGISTRATION_ROUTES.auto,
    },
  ]

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-testid="registration-type-modal-overlay"
      onMouseDown={onClose}
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-type-title"
        data-testid="registration-type-modal"
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-5 sm:p-8 max-w-2xl w-full shadow-modal animate-slide-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="registration-type-title" className="text-xl font-bold text-ink">
              {t('admin.code_add_select_title')}
            </h2>
            <p className="text-sm text-muted mt-1">{t('admin.code_add_select_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.close')}
            className="text-muted hover:text-ink shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
          {options.map(({ key, icon: Icon, label, description, to }) => (
            <button
              key={key}
              type="button"
              data-testid={`reg-type-${key}`}
              onClick={() => onSelect(to)}
              className="group relative w-full text-left overflow-hidden rounded-2xl p-4 sm:p-5 border border-border bg-white text-ink transition-all duration-300 hover:border-primary/40 hover:shadow-card-hover hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {/* Inline on small screens to keep the stacked list compact,
                  stacked from sm up to match the Dashboard action cards. */}
              <div className="flex sm:block">
                <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center shrink-0 mr-3 sm:mb-4 sm:mr-0 transition-all duration-300 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/25">
                  <Icon className="w-5 h-5 text-primary transition-colors duration-300 group-hover:text-white" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight text-ink">{label}</p>
                  <p className="text-xs mt-1 leading-snug text-muted">{description}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs font-medium mt-4 text-primary">
                {t('dashboard.get_started')}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CodeDetailsModal({ item, onClose }) {
  const { t } = useTranslation()
  const rows = [
    { label: t('admin.code_name'), value: item.code_name },
    { label: t('admin.code_type'), value: codeTypeLabel(t, item.code_type) },
    { label: t('admin.code_country'), value: [item.country, item.state, item.city].filter(Boolean).join(', ') },
    { label: t('admin.code_street'), value: item.street_address },
    { label: t('admin.code_postal'), value: item.postal_code },
    { label: t('admin.code_coords'), value: `${item.latitude}, ${item.longitude}` },
    { label: t('admin.code_owner'), value: item.owner_email || '—' },
    { label: t('admin.code_status'), value: item.is_active ? t('admin.active') : t('admin.inactive') },
    { label: t('admin.created_at'), value: item.created_at ? new Date(item.created_at).toLocaleString() : '—' },
  ]
  return (
    <div data-testid="code-details-modal" className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-modal">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">{t('admin.code_view_title')}</h2>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <dl className="space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted shrink-0">{label}</dt>
              <dd className="text-sm text-ink text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="secondary" onClick={onClose} className="w-full mt-6">
          {t('admin.close')}
        </Button>
      </div>
    </div>
  )
}

export default function AdminCyraCodes() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState({ items: [], total: 0 })
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigatingRef = useRef(false)
  const pageSize = 20

  // Edit flow — mirrors the user-facing Manage CyraCodes editor.
  const [editing, setEditing] = useState(null)
  const [step, setStep] = useState(1)
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState(EMPTY_ADDRESS)
  const [addressErrors, setAddressErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const clearFieldError = (field) =>
    setAddressErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })

  const handleSelectRegistration = (path) => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    setTypeModalOpen(false)
    if (!Object.values(REGISTRATION_ROUTES).includes(path)) {
      toast.error(t('admin.code_add_route_unavailable'))
      navigatingRef.current = false
      return
    }
    navigate(path)
  }

  // The list endpoint only returns summary columns, so the full record is
  // fetched before the editor opens in order to prefill every address field.
  const handleEdit = async (item) => {
    setLoadingEdit(true)
    try {
      const { data: rec } = await admin.getCyracode(item.id)
      const prefill = { ...EMPTY_ADDRESS }
      prefill.country_code = rec.country_code === 'XX' ? 'OTHER' : rec.country_code || ''
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

      setEditing(rec)
      setCoords({ lat: Number(rec.latitude), lng: Number(rec.longitude) })
      setAddress(prefill)
      setAddressErrors({})
      setStep(1)
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.code_list_failed')))
    } finally {
      setLoadingEdit(false)
    }
  }

  // Highlight the saved state in the dropdown once its ISO code is resolved.
  useEffect(() => {
    if (!editing) return undefined
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
      await admin.updateCyracode(editing.id, payload)
      toast.success(t('edit.saved_success'))
      cancelEdit()
      load({ q: query || undefined, is_active: isActiveFilter || undefined, page, page_size: pageSize })
    } catch (err) {
      toast.error(apiErrorMessage(err, t('edit.save_failed')))
    } finally {
      setSaving(false)
    }
  }

  const load = useCallback((params) => {
    setLoading(true)
    admin
      .listCyracodes(params)
      .then(({ data: res }) => {
        setData(res)
      })
      .catch((err) => toast.error(apiErrorMessage(err, t('admin.code_list_failed'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input)
    }, 300)
    return () => clearTimeout(timer)
  }, [input])

  useEffect(() => {
    setPage(1)
  }, [query, isActiveFilter])

  useEffect(() => {
    load({ q: query || undefined, is_active: isActiveFilter || undefined, page, page_size: pageSize })
  }, [query, isActiveFilter, page, pageSize, load])

  const handleDelete = async () => {
    setBusy(true)
    try {
      await admin.deleteCyracode(deleteTarget.id)
      toast.success(t('admin.code_deleted'))
      setDeleteTarget(null)
      load({ q: query || undefined, is_active: isActiveFilter || undefined, page, page_size: pageSize })
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.code_delete_failed')))
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (item) => {
    try {
      await admin.restoreCyracode(item.id)
      toast.success(t('admin.code_restored'))
      load({ q: query || undefined, is_active: isActiveFilter || undefined, page, page_size: pageSize })
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.code_delete_failed')))
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize))

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
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{t('edit.name_immutable')}</span>
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

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-5xl" />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        {editing ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-ink">{t('admin.code_edit_title')}</h1>
              <p className="text-sm text-muted">{t('admin.code_list_subtitle')}</p>
            </div>
            <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8">
              {renderEdit()}
            </div>
            {step === 2 && (
              <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t('edit.pick_hint', { name: editing.code_name })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-ink">{t('admin.cyracodes_title')}</h1>
                <p className="text-sm text-muted">{t('admin.code_list_subtitle')}</p>
              </div>
              <Button onClick={() => setTypeModalOpen(true)}>
                <Plus className="w-4 h-4" aria-hidden="true" /> {t('admin.code_add')}
              </Button>
            </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('admin.code_search_hint')}
              aria-label={t('admin.code_search_hint')}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={isActiveFilter}
            onChange={(e) => setIsActiveFilter(e.target.value)}
            aria-label={t('admin.code_status_filter')}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('admin.filter_all')}</option>
            <option value="true">{t('admin.active')}</option>
            <option value="false">{t('admin.inactive')}</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.no_codes')}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">{t('admin.code_name')}</th>
                    <th className="px-4 py-3">{t('admin.code_country')}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t('admin.code_owner')}</th>
                    <th className="px-4 py-3">{t('admin.code_type')}</th>
                    <th className="px-4 py-3">{t('admin.code_status')}</th>
                    <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-ink">{item.code_name}</td>
                      <td className="px-4 py-3 text-muted">
                        {[item.city, item.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell">{item.owner_email || '—'}</td>
                      <td className="px-4 py-3 text-muted">{item.code_type ? codeTypeLabel(t, item.code_type) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {item.is_active ? t('admin.active') : t('admin.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal({ mode: 'view', item })} aria-label={`${t('admin.view')} ${item.code_name}`} className="p-2 text-muted hover:text-ink hover:bg-slate-100 rounded-lg">
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button onClick={() => handleEdit(item)} disabled={loadingEdit} aria-label={`${t('admin.edit')} ${item.code_name}`} className="p-2 text-muted hover:text-ink hover:bg-slate-100 rounded-lg disabled:opacity-50">
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          {item.is_active ? (
                            <button onClick={() => setDeleteTarget(item)} aria-label={`${t('admin.delete')} ${item.code_name}`} className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <button onClick={() => handleRestore(item)} aria-label={`${t('admin.restore')} ${item.code_name}`} className="p-2 text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                              <RotateCcw className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {t('admin.showing')} {data.total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)} {t('admin.of')} {data.total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t('admin.prev')}
                </Button>
                <span>{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t('admin.next')}
                </Button>
              </div>
            </div>
          </>
        )}
          </>
        )}
      </main>

      {typeModalOpen && (
        <RegistrationTypeModal
          onSelect={handleSelectRegistration}
          onClose={() => setTypeModalOpen(false)}
        />
      )}

      {modal && modal.mode === 'view' && (
        <CodeDetailsModal item={modal.item} onClose={() => setModal(null)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-modal">
            <h2 className="text-lg font-bold text-ink">{t('admin.code_delete_title')}</h2>
            <p className="text-sm text-muted mt-1 mb-6">{t('admin.code_delete_body', { name: deleteTarget.code_name })}</p>
            <div className="flex gap-3">
              <Button variant="danger" loading={busy} onClick={handleDelete} className="flex-1">
                {t('admin.confirm_delete')}
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">
                {t('admin.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}