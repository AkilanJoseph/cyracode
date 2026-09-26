import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Minus, ArrowRight, Rocket, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Header from '../components/common/Header'
import { billing } from '../services/api'
import { PUBLIC_PLANS } from '../lib/plans'

const CUSTOMER_SALES_MAILTO = 'mailto:sales@cyracode.com'

// Feature matrix for the comparison table (row id â†’ per-plan value).
const COMPARISON_ROWS = [
  'allowance',
  'lookup',
  'uptime',
  'support',
  'analytics',
  'overage',
]

const planFeatureCoverage = {
  sandbox: { allowance: '1,000', lookup: 'basic', uptime: false, support: 'community', analytics: false, overage: false },
  developer: { allowance: '100,000', lookup: 'full', uptime: true, support: 'standard', analytics: false, overage: true },
  growth: { allowance: '1M', lookup: 'full', uptime: true, support: 'priority', analytics: true, overage: true },
  scale: { allowance: '10M', lookup: 'full', uptime: true, support: 'priority', analytics: true, overage: true },
  enterprise: { allowance: 'âˆž', lookup: 'full', uptime: true, support: 'dedicated', analytics: true, overage: true },
}

const TICKER = [
  { key: 'requests', value: '24.8M' },
  { key: 'uptime', value: '99.99%' },
  { key: 'response', value: '38ms' },
  { key: 'regions', value: '12' },
]

export default function PricingPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [billingFreq, setBilling] = useState(() => searchParams.get('billing') === 'annual' ? 'annual' : 'monthly')
  const [plans, setPlans] = useState(PUBLIC_PLANS)
  const [volume, setVolume] = useState(2)

  useEffect(() => {
    let active = true
    billing.plans()
      .then(({ data }) => {
        if (active && Array.isArray(data) && data.length) setPlans(data)
      })
      .catch(() => { /* keep static catalog */ })
    return () => { active = false }
  }, [])

  const recommended = useMemo(() => {
    if (volume >= 10) return 'enterprise'
    if (volume >= 1) return 'growth'
    return 'developer'
  }, [volume])

  const recommendedPlan = plans.find((p) => p.code === recommended)

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-7xl" marketingNav />

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto animate-fade-in-up">
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold uppercase tracking-wide">
            {t('pricing.eyebrow')}
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-ink tracking-tight leading-[1.1]">
            {t('pricing.hero_title')}
          </h1>
          <p className="mt-4 text-lg text-muted leading-relaxed">{t('pricing.hero_subtitle')}</p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            {t('pricing.status_operational')}
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TICKER.map(({ key, value }) => (
              <div key={key} className="rounded-2xl border border-border bg-white px-4 py-4 text-left shadow-card">
                <p className="text-lg font-bold text-ink">{value}</p>
                <p className="text-xs text-muted mt-0.5">{t(`pricing.ticker_${key}`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Billing toggle */}
        <div className="mt-12 flex items-center justify-center gap-3">
          <div className="inline-flex gap-1 bg-white border border-border rounded-xl p-1 shadow-card">
            {['monthly', 'annual'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                aria-pressed={billingFreq === b}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billingFreq === b ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {t(`pricing.toggle_${b}`)}
              </button>
            ))}
          </div>
          {billingFreq === 'annual' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 animate-fade-in-up">
              {t('pricing.save_badge')}
            </span>
          )}
        </div>

        {/* Plan cards */}
        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-stretch">
          {plans.map((plan) => {
            const featured = plan.featured
            const custom = plan.custom_price
            const price = billingFreq === 'annual' ? plan.annual_price_per_month : plan.monthly_price
            const annualTotal = billingFreq === 'annual' ? plan.annual_price_per_year : null
            const checkoutArgs = `plan=${plan.code}&billing=${billingFreq}`
            return (
              <div
                key={plan.code}
                className={`relative flex flex-col rounded-2xl border p-6 bg-white transition-shadow ${
                  featured ? 'border-primary shadow-card-hover ring-1 ring-primary' : 'border-border shadow-card hover:shadow-card-hover'
                }`}
                data-testid={`plan-${plan.code}`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1">
                    {t('pricing.most_called')}
                  </div>
                )}
                <p className="font-semibold text-ink">{plan.name}</p>
                <p className="text-xs text-muted mt-1 leading-snug min-h-[2.5rem]">
                  {t(`pricing.plan_${plan.code}_desc`)}
                </p>

                <div className="mt-4">
                  {custom ? (
                    <p className="text-2xl font-extrabold text-ink">{t('pricing.custom_price')}</p>
                  ) : (
                    <>
                      <p className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-ink">${Math.round(price)}</span>
                        <span className="text-sm text-muted">{t('pricing.per_month')}</span>
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {billingFreq === 'annual'
                          ? t('pricing.billed_annual_total', { total: annualTotal })
                          : t('pricing.billed_monthly_total')}
                      </p>
                    </>
                  )}
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t('pricing.allowance_label')}</dt>
                    <dd className="font-semibold text-ink">{plan.monthly_allowance}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{t('pricing.overage_label')}</dt>
                    <dd className="font-medium text-ink">
                      {plan.overage_rate ? `$${plan.overage_rate}/1K` : 'â€”'}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-ink/80">{t(`pricing.feature.${f}`)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.code === 'enterprise' ? (
                    <a
                      href={CUSTOMER_SALES_MAILTO}
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
                    >
                      {t('pricing.cta_contact_sales')}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </a>
                  ) : plan.code === 'sandbox' ? (
                    <Link
                      to="/register/auto-generate"
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
                    >
                      {t('pricing.cta_start_free')}
                    </Link>
                  ) : (
                    <Link
                      to={`/payment?${checkoutArgs}`}
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      {t('pricing.cta_get_started')}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* Volume calculator */}
        <section className="mt-16 rounded-3xl border border-border bg-white p-6 md:p-10 shadow-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-ink">{t('pricing.calculator_title')}</h2>
              <p className="text-sm text-muted mt-1">{t('pricing.calculator_subtitle')}</p>
              <div className="mt-6">
                <label htmlFor="volume-slider" className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-ink">{t('pricing.calculator_runs_label')}</span>
                  <span className="text-lg font-extrabold text-primary">
                    {volume >= 1 ? `${volume}M` : `${Math.round(volume * 1000)}K`}
                  </span>
                </label>
                <input
                  id="volume-slider"
                  type="range"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="mt-3 w-full accent-primary"
                  aria-valuetext={`${volume}M requests per month`}
                />
                <div className="flex justify-between text-[10px] text-muted mt-1">
                  <span>100K</span>
                  <span>50M</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary-light/40 p-6 text-center" data-testid="recommendation-box">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('pricing.calculator_recommend')}</p>
              <p className="mt-2 text-2xl font-extrabold text-ink">{recommendedPlan?.name}</p>
              <p className="mt-1 text-sm text-muted">
                {t('pricing.calculator_reason', { volume: volume >= 1 ? `${volume}M` : `${Math.round(volume * 1000)}K` })}
              </p>
              <div className="mt-5">
                {recommended === 'enterprise' ? (
                  <a
                    href={CUSTOMER_SALES_MAILTO}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
                  >
                    {t('pricing.cta_contact_sales')}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                ) : (
                  <Link
                    to={`/payment?plan=${recommended}&billing=${billingFreq}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
                  >
                    {t('pricing.cta_get_started')}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-ink text-center">{t('pricing.compare_title')}</h2>
          <p className="text-sm text-muted text-center mt-1">{t('pricing.compare_subtitle')}</p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-white shadow-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60">
                  <th className="text-left px-5 py-4 font-semibold text-ink">{t('pricing.table_feature')}</th>
                  {plans.map((plan) => (
                    <th key={plan.code} className="px-4 py-4 text-center font-semibold">
                      {plan.name}
                      {plan.featured && (
                        <span className="ml-1.5 rounded-full bg-primary text-white text-[9px] font-bold uppercase px-1.5 py-0.5 align-middle">
                          {t('pricing.most_called')}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-5 py-3.5 font-medium text-ink">{t('pricing.table_price')}</td>
                  {plans.map((plan) => (
                    <td key={plan.code} className="px-4 py-3.5 text-center font-semibold text-ink">
                      {plan.custom_price
                        ? t('pricing.custom_price')
                        : billingFreq === 'annual'
                          ? `$${plan.annual_price_per_month}/mo`
                          : `$${plan.monthly_price}/mo`}
                    </td>
                  ))}
                </tr>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row} className="border-b border-border last:border-0">
                    <td className="px-5 py-3.5 font-medium text-ink">{t(`pricing.compare_${row}`)}</td>
                    {plans.map((plan) => {
                      const cell = planFeatureCoverage[plan.code]?.[row]
                      if (row === 'allowance') {
                        return <td key={plan.code} className="px-4 py-3.5 text-center text-ink/80">{cell}</td>
                      }
                      if (row === 'support' || row === 'lookup') {
                        return (
                          <td key={plan.code} className="px-4 py-3.5 text-center text-ink/80 capitalize">
                            {t(`pricing.support_${cell}`)}
                          </td>
                        )
                      }
                      return (
                        <td key={plan.code} className="px-4 py-3.5 text-center">
                          {cell ? (
                            <Check className="w-4 h-4 text-emerald-500 inline-block" aria-label={t('pricing.yes')} aria-hidden="true" />
                          ) : (
                            <Minus className="w-4 h-4 text-muted inline-block" aria-label={t('pricing.no')} aria-hidden="true" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            {t('pricing.secure_note')}
          </p>
        </section>

        {/* Bottom CTA band */}
        <section className="mt-16 rounded-3xl bg-primary px-6 py-10 md:px-12 text-center text-white shadow-card-hover">
          <Rocket className="w-8 h-8 mx-auto" aria-hidden="true" />
          <h2 className="mt-3 text-2xl md:text-3xl font-bold">{t('pricing.bottom_title')}</h2>
          <p className="mt-2 text-white/80 max-w-xl mx-auto">{t('pricing.bottom_subtitle')}</p>
          <div className="mt-6 inline-flex flex-wrap justify-center gap-3">
            <Link
              to="/register/auto-generate"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
            >
              {t('pricing.cta_start_free')}
            </Link>
            <Link
              to="/payment?plan=growth&billing=annual"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {t('pricing.cta_get_started')}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}