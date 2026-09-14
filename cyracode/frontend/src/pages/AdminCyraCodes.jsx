import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Search, Plus, Eye, Pencil, Trash2, RotateCcw, X } from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

function CyraCodeFormModal({ mode, initial, onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: initial?.code_name || '',
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    country: initial?.country || '',
    country_code: initial?.country_code || '',
    state: initial?.state || '',
    city: initial?.city || '',
    area: initial?.area || '',
    street_address: initial?.street_address || '',
    postal_code: initial?.postal_code || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const lat = Number(form.latitude)
    const lng = Number(form.longitude)
    const errs = {}
    if (mode === 'create' && !form.name.trim()) errs.name = t('common.required')
    if (form.latitude === '' || Number.isNaN(lat)) errs.latitude = t('common.required')
    if (form.longitude === '' || Number.isNaN(lng)) errs.longitude = t('common.required')
    if (!form.country.trim()) errs.country = t('common.required')
    if (!form.country_code.trim()) errs.country_code = t('common.required')
    if (!form.street_address.trim()) errs.street_address = t('common.required')
    if (!form.postal_code.trim()) errs.postal_code = t('common.required')
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      name: form.name.trim(),
      latitude: lat,
      longitude: lng,
      country: form.country.trim(),
      country_code: form.country_code.trim(),
      state: form.state.trim() || undefined,
      city: form.city.trim() || undefined,
      area: form.area.trim() || undefined,
      street_address: form.street_address.trim(),
      postal_code: form.postal_code.trim(),
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await admin.createCyracode(payload)
        toast.success(t('admin.code_created'))
      } else {
        await admin.updateCyracode(initial.id, payload)
        toast.success(t('admin.code_updated'))
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.code_save_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-modal">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-ink">
            {mode === 'create' ? t('admin.code_add_title') : t('admin.code_edit_title')}
          </h2>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'create' && (
            <Input id="admin-code-name" label={t('admin.code_name')} value={form.name} onChange={set('name')} error={errors.name} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input id="admin-code-lat" label={t('admin.code_lat')} value={form.latitude} onChange={set('latitude')} error={errors.latitude} placeholder="12.9716" />
            <Input id="admin-code-lng" label={t('admin.code_lng')} value={form.longitude} onChange={set('longitude')} error={errors.longitude} placeholder="77.5946" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="admin-code-country" label={t('admin.code_country')} value={form.country} onChange={set('country')} error={errors.country} />
            <Input id="admin-code-cc" label={t('admin.code_country_code')} value={form.country_code} onChange={set('country_code')} error={errors.country_code} placeholder="IN" maxLength={10} />
          </div>
          <Input id="admin-code-street" label={t('admin.code_street')} value={form.street_address} onChange={set('street_address')} error={errors.street_address} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="admin-code-city" label={t('admin.code_city')} value={form.city} onChange={set('city')} />
            <Input id="admin-code-area" label={t('admin.code_area')} value={form.area} onChange={set('area')} />
          </div>
          <Input id="admin-code-state" label={t('admin.code_state')} value={form.state} onChange={set('state')} />
          <Input id="admin-code-postal" label={t('admin.code_postal')} value={form.postal_code} onChange={set('postal_code')} error={errors.postal_code} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {t('admin.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {t('admin.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CodeDetailsModal({ item, onClose }) {
  const { t } = useTranslation()
  const rows = [
    { label: t('admin.code_name'), value: item.code_name },
    { label: t('admin.code_type'), value: item.code_type },
    { label: t('admin.code_country'), value: [item.country, item.state, item.city].filter(Boolean).join(', ') },
    { label: t('admin.code_street'), value: item.street_address },
    { label: t('admin.code_postal'), value: item.postal_code },
    { label: t('admin.code_coords'), value: `${item.latitude}, ${item.longitude}` },
    { label: t('admin.code_owner'), value: item.owner_email || '—' },
    { label: t('admin.code_status'), value: item.is_active ? t('admin.active') : t('admin.inactive') },
    { label: t('admin.created_at'), value: item.created_at ? new Date(item.created_at).toLocaleString() : '—' },
  ]
  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
  const [data, setData] = useState({ items: [], total: 0 })
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const pageSize = 20

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

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.cyracodes_title')}</h1>
            <p className="text-sm text-muted">{t('admin.code_list_subtitle')}</p>
          </div>
          <Button onClick={() => setModal({ mode: 'create' })}>
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
                          <button onClick={() => setModal({ mode: 'edit', item })} aria-label={`${t('admin.edit')} ${item.code_name}`} className="p-2 text-muted hover:text-ink hover:bg-slate-100 rounded-lg">
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
      </main>

      {modal && modal.mode !== 'view' && (
        <CyraCodeFormModal
          key={modal.item?.id || 'new'}
          mode={modal.mode}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load({ q: query || undefined, is_active: isActiveFilter || undefined, page, page_size: pageSize })
          }}
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