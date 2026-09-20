import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  CreditCard, CalendarClock, TrendingUp, Download, ChevronDown, X, ExternalLink,
} from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import { PlanBadge, SubStatusBadge, MONTH_OPTIONS, formatMoney } from '../components/admin/Badges'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

const PAGE_SIZE = 10

function ActionMenu({ onView, onRenew, onChangePlan, onCancel, disabled }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  const item = 'px-3 py-2 text-sm hover:bg-slate-50 w-full text-left flex items-center gap-2'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label={t('admin.subs_actions')}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-ink bg-white border border-border rounded-lg hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        {t('admin.subs_actions')} <ChevronDown className="w-3 h-3" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 w-44 bg-white border border-border rounded-xl shadow-card-hover z-20 py-1 overflow-hidden">
            <button className={item} onClick={() => { setOpen(false); onView(); }}>
              <ExternalLink className="w-4 h-4 text-muted" aria-hidden="true" /> {t('admin.subs_view_client')}
            </button>
            <button className={item} onClick={() => { setOpen(false); onRenew(); }}>
              <CalendarClock className="w-4 h-4 text-muted" aria-hidden="true" /> {t('admin.subs_renew')}
            </button>
            <button className={item} onClick={() => { setOpen(false); onChangePlan(); }}>
              <CreditCard className="w-4 h-4 text-muted" aria-hidden="true" /> {t('admin.subs_change_plan')}
            </button>
            <button className={`${item} text-red-600 hover:bg-red-50`} onClick={() => { setOpen(false); onCancel(); }}>
              {t('admin.subs_cancel')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SubscriptionModal({ mode, subscription, onClose, onSaved }) {
  const { t } = useTranslation()
  const [plans, setPlans] = useState([])
  const [planCode, setPlanCode] = useState(subscription?.plan_code || '')
  const [months, setMonths] = useState(12)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    admin
      .listPlans()
      .then(({ data }) => {
        setPlans(data)
        setPlanCode((prev) => prev || data[0]?.code || '')
      })
      .catch(() => {})
  }, [])

  const submit = async () => {
    setSaving(true)
    try {
      if (mode === 'renew') {
        await admin.renewSubscription(subscription.client_id, { months })
        toast.success(t('admin.sub_renewed'))
      } else {
        await admin.setSubscription(subscription.client_id, { plan: planCode, months })
        toast.success(t('admin.sub_saved'))
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.sub_save_failed')))
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'renew'
    ? t('admin.subs_renew_title', { name: subscription.client_name })
    : t('admin.subs_change_title', { name: subscription.client_name })

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-modal">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4">
          {mode === 'change' && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide">
              {t('admin.subs_plan')}
              <select
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
                className="px-3 py-2.5 text-sm bg-white border border-border rounded-xl text-ink font-normal uppercase-normal tracking-normal outline-none focus:ring-2 focus:ring-primary/20"
              >
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>{p.name} — {formatMoney(p.monthly_cost)}/mo</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide">
            {t('admin.subs_months')}
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="px-3 py-2.5 text-sm bg-white border border-border rounded-xl text-ink font-normal tracking-normal outline-none focus:ring-2 focus:ring-primary/20"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 pt-1">
            <Button loading={saving} onClick={submit} className="flex-1">
              {mode === 'renew' ? t('admin.subs_renew_confirm') : t('admin.sub_set_btn')}
            </Button>
            <Button variant="secondary" onClick={onClose} className="flex-1">
              {t('admin.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminSubscriptions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, page_size: PAGE_SIZE }
    if (statusFilter) params.status = statusFilter
    Promise.all([admin.listSubscriptions(params), admin.dashboard()])
      .then(([subs, dash]) => {
        setItems(subs.data.items)
        setTotal(subs.data.total)
        setSummary(dash.data)
      })
      .catch((err) => toast.error(apiErrorMessage(err, t('admin.subs_list_failed'))))
      .finally(() => setLoading(false))
  }, [page, statusFilter, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const summaryCards = summary
    ? [
        {
          icon: CreditCard,
          label: t('admin.subs_active'),
          value: String(summary.active_subscriptions),
          tone: 'text-emerald-600',
        },
        {
          icon: CalendarClock,
          label: t('admin.subs_expiring_soon'),
          value: String(summary.expiring_soon),
          tone: summary.expiring_soon > 0 ? 'text-red-600' : 'text-muted',
        },
        {
          icon: TrendingUp,
          label: t('admin.subs_renewal_rate'),
          value: `${summary.renewal_rate.toFixed(1)}%`,
          tone: 'text-emerald-600',
        },
      ]
    : []

  const exportCsv = async () => {
    try {
      const { data } = await admin.listSubscriptions({ page_size: 500, status: statusFilter || undefined })
      const header = ['Client', 'Plan', 'Monthly Cost (USD)', 'Start Date', 'End Date', 'Status']
      const rows = data.items.map((s) => [
        s.client_name,
        s.plan_name,
        s.monthly_cost,
        s.start_date ? new Date(s.start_date).toISOString().slice(0, 10) : '',
        s.end_date ? new Date(s.end_date).toISOString().slice(0, 10) : '',
        s.status,
      ])
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cyracode-subscriptions.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('admin.subs_exported', { n: data.items.length }))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.subs_list_failed')))
    }
  }

  const handleCancel = async () => {
    setBusy(true)
    try {
      await admin.cancelSubscription(cancelTarget.client_id)
      toast.success(t('admin.sub_cancelled'))
      setCancelTarget(null)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.sub_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  const goToClient = (s) => navigate(`/admin/clients?client=${s.client_id}`)

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.subs_title')}</h1>
            <p className="text-sm text-muted">{t('admin.subs_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
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
              <option value="cancelled">{t('admin.subs_status_cancelled')}</option>
            </select>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="w-4 h-4" aria-hidden="true" /> {t('admin.subs_export')}
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {summaryCards.map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className={`text-2xl font-bold text-ink mt-0.5 ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.subs_no_items')}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">{t('admin.tx_client')}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t('admin.subs_plan')}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t('admin.subs_cost')}</th>
                    <th className="px-4 py-3 hidden lg:table-cell">{t('admin.sub_start')}</th>
                    <th className="px-4 py-3 hidden lg:table-cell">{t('admin.sub_expiry')}</th>
                    <th className="px-4 py-3">{t('admin.subs_status')}</th>
                    <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button onClick={() => goToClient(s)} className="text-left">
                          <p className="font-semibold text-ink hover:text-primary">{s.client_name}</p>
                          {!s.is_active && <p className="text-xs text-red-600">{t('admin.inactive')}</p>}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><PlanBadge planName={s.plan_name} /></td>
                      <td className="px-4 py-3 font-semibold text-ink hidden md:table-cell">{formatMoney(s.monthly_cost)}/mo</td>
                      <td className="px-4 py-3 text-muted hidden lg:table-cell">{new Date(s.start_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-muted hidden lg:table-cell">{new Date(s.end_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><SubStatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <ActionMenu
                            disabled={!!modal}
                            onView={() => goToClient(s)}
                            onRenew={() => setModal({ mode: 'renew', subscription: s })}
                            onChangePlan={() => setModal({ mode: 'change', subscription: s })}
                            onCancel={() => setCancelTarget(s)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {t('admin.showing')} {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} {t('admin.of')} {total}
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

      {modal && (
        <SubscriptionModal
          mode={modal.mode}
          subscription={modal.subscription}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-modal">
            <h2 className="text-lg font-bold text-ink">{t('admin.subs_cancel_title')}</h2>
            <p className="text-sm text-muted mt-1 mb-6">{t('admin.subs_cancel_body', { name: cancelTarget.client_name })}</p>
            <div className="flex gap-3">
              <Button variant="danger" loading={busy} onClick={handleCancel} className="flex-1">
                {t('admin.confirm_cancel')}
              </Button>
              <Button variant="secondary" onClick={() => setCancelTarget(null)} className="flex-1">
                {t('admin.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}