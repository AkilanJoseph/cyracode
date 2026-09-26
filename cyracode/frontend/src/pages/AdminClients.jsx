import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  Plus, X, Copy, Check, KeyRound, Power, Trash2, RotateCw, Eye, Search,
  CreditCard, CalendarDays, Terminal, Play, Loader2, ShieldCheck,
} from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import { PlanBadge, SubStatusBadge, MONTH_OPTIONS, formatMoney } from '../components/admin/Badges'
import { admin, clientApi } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

const LOOKUP_PERMISSION = 'cyracode.lookup'
const PAGE_SIZE = 10

function ApiKeyReveal({ apiKey, label, hint }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [testCode, setTestCode] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      toast.success(t('admin.key_copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('admin.key_copy_failed'))
    }
  }

  const testKey = async (e) => {
    e.preventDefault()
    const code = testCode.trim()
    if (!code) return
    setTesting(true)
    setResult(null)
    try {
      const { data } = await clientApi.lookupAddress(apiKey, code)
      setResult({ ok: true, body: data })
      toast.success(t('admin.api_test_success'))
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message
      setResult({ ok: false, body: { error: detail } })
      toast.error(t('admin.api_test_failed'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-light/40 p-4">
      <p className="text-xs font-semibold text-primary mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm break-all bg-white border border-border rounded-xl px-3 py-2 font-mono">{apiKey}</code>
        <Button variant="secondary" size="sm" onClick={copy} aria-label={t('admin.copy_key')}>
          {copied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted mt-2">{hint}</p>}

      <div className="mt-4 border-t border-primary/20 pt-3">
        <p className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-2">
          <Terminal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          {t('admin.api_test_title')}
        </p>
        <form onSubmit={testKey} className="flex gap-2">
          <input
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder={t('admin.api_test_placeholder')}
            aria-label={t('admin.api_test_placeholder')}
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <Button type="submit" size="sm" loading={testing} aria-label={t('admin.api_test_btn')}>
            <Play className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.api_test_btn')}
          </Button>
        </form>
        {result && (
          <pre className="mt-3 max-h-48 overflow-auto text-xs font-mono bg-ink text-emerald-300 rounded-xl p-3">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function ClientFormModal({ onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', contact_email: '', grantLookup: true })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [createdKey, setCreatedKey] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = t('common.required')
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      errs.contact_email = t('errors.invalid_email')
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const { data } = await admin.createClient({
        name: form.name.trim(),
        contact_email: form.contact_email.trim() || null,
        permissions: form.grantLookup ? [LOOKUP_PERMISSION] : [],
      })
      setCreatedKey(data.api_key)
      toast.success(t('admin.client_created'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.client_save_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-modal">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-ink">{t('admin.client_add_title')}</h2>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {createdKey ? (
          <div className="space-y-4">
            <ApiKeyReveal
              apiKey={createdKey}
              label={t('admin.key_once')}
              hint={t('admin.key_once_hint')}
            />
            <Button variant="secondary" onClick={onSaved} className="w-full">
              {t('admin.done')}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Input id="admin-client-name" label={t('admin.client_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input id="admin-client-email" label={t('admin.client_email')} type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} error={errors.contact_email} />
            <label className="flex items-start gap-2 cursor-pointer select-none text-sm text-ink">
              <input
                type="checkbox"
                checked={form.grantLookup}
                onChange={(e) => setForm({ ...form, grantLookup: e.target.checked })}
                className="accent-primary w-4 h-4 mt-0.5"
              />
              {t('admin.grant_lookup_default')}
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving} className="flex-1">
                {t('admin.save')}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                {t('admin.cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ClientSubscriptionSection({ client, onChanged, busy, setBusy }) {
  const { t } = useTranslation()
  const [plans, setPlans] = useState(null)
  const [planCode, setPlanCode] = useState('')
  const [months, setMonths] = useState(12)
  const [renewMonths, setRenewMonths] = useState(12)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  useEffect(() => {
    admin
      .listPlans()
      .then(({ data }) => {
        setPlans(data)
        setPlanCode((prev) => prev || data[0]?.code || '')
      })
      .catch(() => {})
  }, [])

  const assignPlan = async () => {
    setBusy(true)
    try {
      await admin.setSubscription(client.id, { plan: planCode, months })
      toast.success(t('admin.sub_saved'))
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.sub_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const renew = async () => {
    setBusy(true)
    try {
      await admin.renewSubscription(client.id, { months: renewMonths })
      toast.success(t('admin.sub_renewed'))
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.sub_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await admin.cancelSubscription(client.id)
      toast.success(t('admin.sub_cancelled'))
      onChanged()
      setCancelConfirm(false)
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.sub_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const hasSub = Boolean(client.subscription_status)

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-3">
        <CreditCard className="w-4 h-4 text-primary" aria-hidden="true" />
        {t('admin.sub_section_title')}
      </h3>

      {hasSub ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <PlanBadge planName={client.plan_name} />
            <SubStatusBadge status={client.subscription_status} />
            <span className="text-sm font-semibold text-ink">{formatMoney(client.monthly_cost)}/mo</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.sub_start')}</dt>
              <dd className="text-ink mt-0.5">{client.subscription_start ? new Date(client.subscription_start).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.sub_expiry')}</dt>
              <dd className="text-ink mt-0.5">{client.expiry_date ? new Date(client.expiry_date).toLocaleDateString() : '—'}</dd>
            </div>
          </dl>

          <div className="rounded-xl bg-primary-light/50 border border-primary/20 p-3">
            <p className="text-xs font-semibold text-ink mb-2">{t('admin.sub_change_plan')}</p>
            {plans && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t('admin.subs_plan')}
                  <select
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>{p.name} — {formatMoney(p.monthly_cost)}/mo</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t('admin.subs_months')}
                  <select
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <Button size="sm" loading={busy} onClick={assignPlan}>{t('admin.sub_set_btn')}</Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold text-ink mb-2">{t('admin.sub_renew_btn')}</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('admin.subs_months')}
                <select
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="outline" loading={busy} onClick={renew}>{t('admin.sub_renew_btn')}</Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted">{t('admin.sub_cancel_hint')}</p>
            {cancelConfirm ? (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={busy} onClick={cancel}>{t('admin.confirm_cancel')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setCancelConfirm(false)}>{t('admin.cancel')}</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setCancelConfirm(true)}>
                {t('admin.sub_cancel_btn')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">{t('admin.client_no_subscription')}</p>
          {plans && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('admin.subs_plan')}
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>{p.name} — {formatMoney(p.monthly_cost)}/mo</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('admin.subs_months')}
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-white border border-border rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <Button size="sm" loading={busy} onClick={assignPlan}>{t('admin.sub_assign_plan')}</Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ClientDetailModal({ client, onClose, onChanged }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [rotatedKey, setRotatedKey] = useState('')
  const [rotateOpen, setRotateOpen] = useState(false)

  const rotate = async () => {
    setBusy(true)
    try {
      const { data } = await admin.rotateClientKey(client.id)
      setRotatedKey(data.api_key)
      setRotateOpen(true)
      toast.success(t('admin.key_rotated'))
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.client_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const togglePermission = async () => {
    setBusy(true)
    try {
      const has = client.permissions.includes(LOOKUP_PERMISSION)
      if (has) {
        await admin.revokePermission(client.id, LOOKUP_PERMISSION)
        toast.success(t('admin.permission_revoked'))
      } else {
        await admin.grantPermissions(client.id, [LOOKUP_PERMISSION])
        toast.success(t('admin.permission_granted'))
      }
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.permission_failed')))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    setBusy(true)
    try {
      await admin.updateClient(client.id, { is_active: !client.is_active })
      toast.success(client.is_active ? t('admin.client_disabled') : t('admin.client_enabled'))
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.client_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('admin.client_delete_body', { name: client.name }))) return
    setBusy(true)
    try {
      await admin.deleteClient(client.id)
      toast.success(t('admin.client_deleted'))
      onClose()
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.client_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-modal">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink">{client.name}</h2>
            <p className="text-xs text-muted mt-0.5">{client.contact_email || '—'}</p>
          </div>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${client.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                <Power className="w-3 h-3" aria-hidden="true" />
                {client.is_active ? t('admin.active') : t('admin.inactive')}
              </span>
              <span className="text-muted">{client.contact_email || '—'}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.key_tail')}</dt>
                <dd className="font-mono text-ink mt-0.5">…{client.key_tail}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.created_at')}</dt>
                <dd className="text-ink mt-0.5">{client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.permissions')}</dt>
                <dd className="mt-0.5 flex items-center gap-2 flex-wrap">
                  {client.permissions.length === 0 ? (
                    <span className="text-xs text-muted">{t('admin.no_permissions')}</span>
                  ) : (
                    client.permissions.map((perm) => (
                      <span key={perm} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary-light text-primary">
                        {perm}
                      </span>
                    ))
                  )}
                  <Button size="sm" variant="outline" loading={busy} onClick={togglePermission}>
                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                    {client.permissions.includes(LOOKUP_PERMISSION) ? t('admin.revoke') : t('admin.grant')}
                  </Button>
                </dd>
              </div>
            </dl>
          </section>

          <ClientSubscriptionSection client={client} onChanged={onChanged} busy={busy} setBusy={setBusy} />

          <section className="rounded-2xl border border-border bg-white p-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              {t('admin.api_docs_title')}
            </h3>
            <p className="text-xs text-muted mb-3">{t('admin.api_docs_hint')}</p>
            <pre className="text-xs font-mono bg-slate-50 border border-border rounded-xl p-3 overflow-x-auto">
{`curl -X GET https://api.cyracode.com/cyracode/{code}/address \\
  -H "X-API-Key: <your_client_api_key>"`}
            </pre>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mt-3 mb-1">{t('admin.api_docs_response')}</p>
            <pre className="text-xs font-mono bg-slate-50 border border-border rounded-xl p-3 overflow-x-auto">
{`{
  "cyracode": "Galileo_Home",
  "address": {
    "address_line1": "12, Sunny Street",
    "city": "Bangalore",
    "state": "Karnataka",
    "postal_code": "560001",
    "country": "India"
  }
}`}
            </pre>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Button size="sm" variant="secondary" loading={rotateOpen && busy} onClick={rotate}>
                <RotateCw className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.rotate_key')}
              </Button>
              <span className="text-xs text-muted">{t('admin.api_key_rotation_hint')}</span>
            </div>
            {rotatedKey && (
              <div className="mt-3">
                <ApiKeyReveal apiKey={rotatedKey} label={t('admin.key_rotated_now')} hint={t('admin.key_once_hint')} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-red-200 bg-red-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{t('admin.client_danger_hint')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" loading={busy} onClick={toggleActive}>
                <Power className="w-3.5 h-3.5" aria-hidden="true" />
                {client.is_active ? t('admin.disable') : t('admin.enable')}
              </Button>
              <Button size="sm" variant="danger" loading={busy} onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.delete')}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function AdminClients() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const qParam = searchParams.get('q') || ''
  const clientParam = searchParams.get('client') || ''

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(qParam)
  const [debouncedSearch, setDebouncedSearch] = useState(qParam)
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [viewClient, setViewClient] = useState(null)
  const [plans, setPlans] = useState([])

  useEffect(() => {
    admin.listPlans().then(({ data }) => setPlans(data)).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, planFilter])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (debouncedSearch) params.q = debouncedSearch
    if (statusFilter) params.status = statusFilter
    if (planFilter) params.plan = planFilter
    admin
      .listClients(params)
      .then(({ data }) => {
        setClients(data)
        if (clientParam) {
          const found = data.find((c) => c.id === clientParam)
          if (found && !viewClient) setViewClient(found)
        }
      })
      .catch((err) => toast.error(apiErrorMessage(err, t('admin.client_list_failed'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, planFilter, clientParam])

  useEffect(() => {
    load()
  }, [load])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return clients.slice(start, start + PAGE_SIZE)
  }, [clients, page])
  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE))

  const exposeDetail = (c) => {
    setViewClient(c)
    setSearchParams({ client: c.id }, { replace: true })
  }

  const closeDetail = () => {
    if (qParam || searchParams.get('client')) {
      setSearchParams({}, { replace: true })
    }
    setViewClient(null)
  }

  const changed = useCallback(() => {
    load()
    if (viewClient) {
      admin
        .listClients({ q: debouncedSearch || undefined })
        .then(({ data }) => {
          const fresh = data.find((c) => c.id === viewClient.id)
          if (fresh) setViewClient(fresh)
        })
        .catch(() => {})
    }
  }, [load, debouncedSearch, viewClient])

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-5xl" />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.clients_title')}</h1>
            <p className="text-sm text-muted">{t('admin.client_list_subtitle')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('admin.client_add')}
          </Button>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 mb-4">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.client_search_hint')}
              aria-label={t('admin.client_search_hint')}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('admin.subs_filter_status')}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('admin.subs_status_all')}</option>
            <option value="active">{t('admin.subs_status_active')}</option>
            <option value="expiring">{t('admin.subs_status_expiring')}</option>
            <option value="expired">{t('admin.subs_status_expired')}</option>
            <option value="none">{t('admin.subs_status_none')}</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label={t('admin.subs_filter_plan')}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('admin.subs_plan_all')}</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.no_clients')}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">{t('admin.client_name')}</th>
                    <th className="px-4 py-3 hidden lg:table-cell">{t('admin.key_tail')}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t('admin.subs_plan')}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t('admin.sub_expiry')}</th>
                    <th className="px-4 py-3">{t('admin.client_status')}</th>
                    <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button onClick={() => exposeDetail(client)} className="text-left">
                          <p className="font-semibold text-ink hover:text-primary">{client.name}</p>
                          <p className="text-xs text-muted">{client.contact_email || '—'}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted hidden lg:table-cell">
                        <code className="font-mono">…{client.key_tail}</code>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {client.subscription_status ? <PlanBadge planName={client.plan_name} /> : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell">
                        {client.expiry_date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                            {new Date(client.expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!client.is_active ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {t('admin.inactive')}
                          </span>
                        ) : (
                          <SubStatusBadge status={client.subscription_status || 'none'} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => exposeDetail(client)}
                            aria-label={`${t('admin.view')} ${client.name}`}
                            className="p-2 text-muted hover:text-primary hover:bg-primary-light rounded-lg"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {t('admin.showing')} {clients.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, clients.length)} {t('admin.of')} {clients.length}
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

      {showCreate && (
        <ClientFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {viewClient && (
        <ClientDetailModal client={viewClient} onClose={closeDetail} onChanged={changed} />
      )}
    </div>
  )
}