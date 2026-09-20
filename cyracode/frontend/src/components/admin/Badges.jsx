import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, XCircle, Ban, MinusCircle } from 'lucide-react'

export function formatMoney(n) {
  const value = Number(n || 0)
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const MONTH_OPTIONS = [1, 2, 3, 6, 12]

const PLAN_TONES = {
  Enterprise: 'bg-rose-100 text-rose-700',
  Pro: 'bg-sky-100 text-sky-700',
  Basic: 'bg-emerald-100 text-emerald-700',
}

export function PlanBadge({ planName }) {
  const tone = PLAN_TONES[planName] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {planName || '—'}
    </span>
  )
}

const STATUS_META = {
  active: { Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700' },
  expiring: { Icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700' },
  expired: { Icon: XCircle, cls: 'bg-red-100 text-red-700' },
  cancelled: { Icon: Ban, cls: 'bg-slate-100 text-slate-600' },
  none: { Icon: MinusCircle, cls: 'bg-slate-100 text-slate-500' },
}

const STATUS_LABELS = {
  active: 'admin.subs_status_active',
  expiring: 'admin.subs_status_expiring',
  expired: 'admin.subs_status_expired',
  cancelled: 'admin.subs_status_cancelled',
  none: 'admin.subs_status_none',
}

export function SubStatusBadge({ status }) {
  const { t } = useTranslation()
  const meta = STATUS_META[status] || STATUS_META.none
  const Icon = meta.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {t(STATUS_LABELS[status] || STATUS_LABELS.none)}
    </span>
  )
}