import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Receipt, Download, Loader2, Check, X, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Header from '../components/common/Header'
import Footer from '../components/common/Footer'
import { useAuth } from '../context/AuthContext'
import { billing } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US')}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function renewalDate(order) {
  if (!order?.created_at) return null
  const d = new Date(order.created_at)
  d.setMonth(d.getMonth() + (order.billing_frequency === 'annual' ? 12 : 1))
  return d
}

function downloadInvoice(order) {
  const lines = [
    'CyraCode — API Plans',
    '=====================================',
    `Invoice  : ${order.order_no}`,
    `Date     : ${formatDate(order.created_at)}`,
    `Email    : ${order.email}`,
    '',
    `Plan     : ${order.plan_name}`,
    `Billing  : ${order.billing_frequency}`,
    '',
    `Subtotal : ${money(order.amount)}`,
    `Tax      : ${money(order.tax_amount)}`,
    `Total    : ${money(order.total_amount)} (${order.currency})`,
    '',
    `Status   : ${order.status}`,
    '=====================================',
    'Thank you for using CyraCode.',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${order.order_no.toLowerCase()}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [orders, setOrders] = useState([])
  const [toggling, setToggling] = useState(null)

  const active = orders.find((o) => o.status === 'paid')

  // The route sits behind ProtectedRoute and the backend scopes the query to
  // the token's account, so a customer's orders and invoices cannot be read by
  // anyone who happens to know their email address. There is no search box
  // because there is nothing left to search on.
  const email = user?.email

  useEffect(() => {
    if (!email) return undefined
    let cancelled = false
    setLoading(true)
    billing
      .listOrders()
      .then(({ data }) => {
        if (cancelled) return
        setOrders(data)
        setSearched(true)
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err, t('orders.lookup_failed')))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [email, t])

  const toggleAutoRenew = async (order) => {
    setToggling(order.id)
    try {
      const { data } = await billing.setAutoRenew(order.id, !order.auto_renew)
      setOrders((prev) => prev.map((o) => (o.id === data.id ? { ...o, ...data } : o)))
      toast.success(data.auto_renew ? t('orders.auto_renew_on') : t('orders.auto_renew_off'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('orders.action_failed')))
    } finally {
      setToggling(null)
    }
  }

  const handleCancel = async (order) => {
    setToggling(order.id)
    try {
      const { data } = await billing.cancelOrder(order.id)
      setOrders((prev) => prev.map((o) => (o.id === data.id ? { ...o, ...data } : o)))
      toast.success(t('orders.cancelled'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('orders.action_failed')))
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-6xl" marketingNav />

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-ink">{t('orders.title')}</h1>
        <p className="mt-1 text-muted">{t('orders.subtitle')}</p>

        {loading && !searched && (
          <p
            className="mt-10 flex items-center justify-center gap-2 text-sm text-muted"
            data-testid="orders-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
            {t('orders.lookup')}
          </p>
        )}

        {searched && !loading && orders.length === 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-white p-10 text-center shadow-card">
            <Receipt className="w-10 h-10 text-muted mx-auto" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink">{t('orders.empty_title')}</p>
            <p className="mt-1 text-sm text-muted">{t('orders.empty_body')}</p>
            <Link
              to="/pricing"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              {t('orders.browse_plans')}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {active && (
          <section className="mt-10 rounded-2xl border border-primary/25 bg-white p-6 shadow-card" data-testid="active-subscription">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('orders.active_subscription')}</p>
                <p className="mt-1 text-lg font-bold text-ink">{active.plan_name}</p>
                <p className="text-sm text-muted">
                  {t('orders.renews_on', { date: formatDate(renewalDate(active)) })} · {money(active.total_amount)}
                </p>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
              >
                {t('orders.upgrade')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {orders.length > 0 && (
          <section className="mt-8 space-y-4">
            <h2 className="font-semibold text-ink">{t('orders.invoice_history')}</h2>
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-border bg-white p-5 shadow-card" data-testid="order-row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{order.plan_name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {order.order_no} · {t(`orders.freq_${order.billing_frequency}`)} · {formatDate(order.created_at)}
                    </p>
                    <p className="text-sm text-muted">{money(order.total_amount)} {order.currency} · {t(`orders.method_${order.payment_method || 'card'}`)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => downloadInvoice(order)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      {t('orders.download')}
                    </button>
                    {order.status === 'paid' && (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={order.auto_renew}
                            disabled={toggling === order.id}
                            onChange={() => toggleAutoRenew(order)}
                            className="accent-primary w-3.5 h-3.5"
                          />
                          {t('orders.auto_renew')}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleCancel(order)}
                          disabled={toggling === order.id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('orders.cancel_subscription')}
                        </button>
                      </div>
                    )}
                    {toggling === order.id && <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {!searched && !loading && (
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
            <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            {t('orders.secure_note')}
          </p>
        )}
      </main>
    <Footer maxWidth="max-w-3xl" />
    </div>
  )
}