import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Search, Users, DollarSign, CalendarClock, Wrench } from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import { PlanBadge, formatMoney } from '../components/admin/Badges'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'
import { useAuth } from '../context/AuthContext'

const W = 420
const H = 190
const PAD = 12

function RevenueChart({ data }) {
  const { t } = useTranslation()
  const max = Math.max(...data.map((d) => d.amount || 0), 1)
  const stepX = (W - PAD * 2) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => {
    const x = PAD + i * stepX
    const y = H - PAD - ((d.amount || 0) / max) * (H - PAD * 2)
    return [x, y]
  })

  const line = points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t('admin.revenue_trend')}>
        <defs>
          <linearGradient id="rev-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#069494', stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: '#069494', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#rev-grad)" />
        <polyline points={line} fill="none" stroke="#069494" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={`${PAD},${H - PAD} ${W - PAD},${H - PAD}`} fill="none" stroke="#E2E8F0" strokeWidth="1" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted mt-1">
        <span>{data[0]?.month}</span>
        <span>{data[Math.floor(data.length / 2)]?.month}</span>
        <span>{data[data.length - 1]?.month}</span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    admin
      .dashboard()
      .then(({ data }) => {
        if (active) {
          setDash(data)
          setError(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(true)
          toast.error(apiErrorMessage(err, t('admin.stats_failed')))
        }
      })
    return () => {
      active = false
    }
  }, [t])

  const submitSearch = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/admin/clients?q=${encodeURIComponent(q)}`)
  }

  const kpis = dash
    ? [
        {
          icon: Users,
          label: t('admin.kpi_total_clients'),
          value: dash.total_clients.toLocaleString(),
          sub: `${dash.active_clients} ${t('admin.kpi_active_clients')}`,
          subCls: 'text-emerald-600',
          to: '/admin/clients',
          testId: 'kpi-total-clients',
        },
        {
          icon: DollarSign,
          label: t('admin.kpi_mrr'),
          value: formatMoney(dash.monthly_recurring_revenue),
          sub: t('admin.kpi_mrr_sub'),
          subCls: 'text-muted',
        },
        {
          icon: CalendarClock,
          label: t('admin.kpi_expiring'),
          value: dash.expiring_soon.toLocaleString(),
          sub: t('admin.kpi_expiring_sub'),
          subCls: 'text-muted',
          valueCls: dash.expiring_soon > 0 ? 'text-red-600' : '',
        },
        {
          icon: Wrench,
          label: t('admin.kpi_api_issues'),
          value: dash.api_issues_24h.toLocaleString(),
          sub: `${dash.api_calls_24h.toLocaleString()} ${t('admin.kpi_api_calls')}`,
          subCls: dash.api_issues_24h > 0 ? 'text-red-600' : 'text-muted',
          valueCls: dash.api_issues_24h > 0 ? 'text-red-600' : '',
        },
      ]
    : []

  const planTotal = useMemo(
    () => (dash?.subscriptions_by_plan || []).reduce((sum, p) => sum + p.clients, 0) || 1,
    [dash]
  )
  const planColors = ['bg-rose-500', 'bg-sky-500', 'bg-emerald-400', 'bg-slate-400']

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-5xl" />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <form onSubmit={submitSearch} className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.dashboard_title')}</h1>
            <p className="text-sm text-muted mt-0.5">{t('admin.dashboard_subtitle')}</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.dashboard_search_hint')}
              aria-label={t('admin.dashboard_search_hint')}
              className="w-72 max-w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </form>

        {error ? (
          <p className="text-sm text-red-500">{t('admin.stats_failed')}</p>
        ) : dash ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map(({ icon: Icon, label, value, sub, subCls, valueCls = '', to, testId }) => (
                <div key={label} className="rounded-2xl border border-border bg-white p-5 shadow-card">
                  <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-muted font-medium">{label}</p>
                  {to ? (
                    <button
                      type="button"
                      data-testid={testId}
                      onClick={() => navigate(to)}
                      aria-label={`${label}: ${value}`}
                      className={`text-2xl font-bold text-ink mt-0.5 hover:text-primary transition-colors ${valueCls}`}
                    >
                      {value}
                    </button>
                  ) : (
                    <p className={`text-2xl font-bold text-ink mt-0.5 ${valueCls}`}>{value}</p>
                  )}
                  <p className={`text-xs mt-1 ${subCls}`}>{sub}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mt-6">
              <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
                <h3 className="text-sm font-semibold text-ink mb-4">{t('admin.revenue_trend')}</h3>
                <RevenueChart data={dash.revenue_trend} />
              </div>

              <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
                <h3 className="text-sm font-semibold text-ink mb-4">{t('admin.subs_by_plan')}</h3>
                {dash.subscriptions_by_plan.length === 0 ? (
                  <p className="text-sm text-muted">{t('admin.subs_no_plan_data')}</p>
                ) : (
                  <div className="space-y-4">
                    {dash.subscriptions_by_plan.map((plan, i) => (
                      <div key={plan.name}>
                        <div className="flex items-center justify-between mb-1.5 text-sm">
                          <span className="font-medium text-ink flex items-center gap-2">
                            <PlanBadge planName={plan.name} />
                          </span>
                          <span className="text-muted text-xs">
                            {plan.clients} {t('admin.subs_clients')}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${planColors[i % planColors.length]}`}
                            style={{ width: `${Math.max(4, (plan.clients / planTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white shadow-card mt-6 overflow-hidden">
              <h3 className="text-sm font-semibold text-ink px-5 pt-5">{t('admin.recent_transactions')}</h3>
              {dash.recent_transactions.length === 0 ? (
                <p className="text-sm text-muted px-5 py-6">{t('admin.no_transactions')}</p>
              ) : (
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-5 py-3">{t('admin.tx_client')}</th>
                        <th className="px-5 py-3 hidden sm:table-cell">{t('admin.tx_plan')}</th>
                        <th className="px-5 py-3">{t('admin.tx_amount')}</th>
                        <th className="px-5 py-3 hidden md:table-cell">{t('admin.tx_date')}</th>
                        <th className="px-5 py-3">{t('admin.tx_status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dash.recent_transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-semibold text-ink">{tx.client_name}</td>
                          <td className="px-5 py-3 hidden sm:table-cell"><PlanBadge planName={tx.plan_name} /></td>
                          <td className="px-5 py-3 font-semibold text-ink">{formatMoney(tx.amount)}</td>
                          <td className="px-5 py-3 text-muted hidden md:table-cell">
                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {tx.status === 'paid' ? t('admin.tx_paid') : t('admin.tx_pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        )}

        {user && user.role === 'admin' && (
          <p className="mt-8 text-xs text-muted">{t('admin.signed_in_as', { email: user.email })}</p>
        )}
      </main>
    </div>
  )
}