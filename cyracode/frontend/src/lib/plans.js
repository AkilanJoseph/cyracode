// Static self-serve plan catalog (USD). Mirrors billing_service.PUBLIC_PLANS so
// the pricing page and checkout work instantly; the backend /billing/plans
// response overrides the prices whenever it is reachable.
// Integer math matches the backend `(monthly * 8 + 5) // 10` exactly.
export const annualPerMonth = (monthly) => Math.floor((monthly * 8 + 5) / 10)

export const PUBLIC_PLANS = [
  {
    code: 'sandbox',
    name: 'Sandbox',
    sort: 0,
    featured: false,
    custom_price: false,
    monthly_price: 0,
    annual_price_per_month: 0,
    annual_price_per_year: 0,
    monthly_allowance: '1,000',
    overage_rate: null,
    features: ['up_to_1k', 'lookup_basic', 'support_community'],
  },
  {
    code: 'developer',
    name: 'Developer',
    sort: 1,
    featured: false,
    custom_price: false,
    monthly_price: 29,
    annual_price_per_month: Math.round(annualPerMonth(29)),
    annual_price_per_year: Math.round(annualPerMonth(29) * 12),
    monthly_allowance: '100,000',
    overage_rate: '0.020',
    features: ['up_to_100k', 'lookup_full', 'uptime_sla', 'support_standard'],
  },
  {
    code: 'growth',
    name: 'Growth',
    sort: 2,
    featured: true,
    custom_price: false,
    monthly_price: 99,
    annual_price_per_month: Math.round(annualPerMonth(99)),
    annual_price_per_year: Math.round(annualPerMonth(99) * 12),
    monthly_allowance: '1,000,000',
    overage_rate: '0.010',
    features: ['up_to_1m', 'lookup_full', 'uptime_sla', 'support_priority', 'analytics'],
  },
  {
    code: 'scale',
    name: 'Scale',
    sort: 3,
    featured: false,
    custom_price: false,
    monthly_price: 349,
    annual_price_per_month: Math.round(annualPerMonth(349)),
    annual_price_per_year: Math.round(annualPerMonth(349) * 12),
    monthly_allowance: '10,000,000',
    overage_rate: '0.004',
    features: ['up_to_10m', 'lookup_full', 'uptime_sla', 'support_priority', 'analytics', 'dedicated_engineer'],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    sort: 4,
    featured: false,
    custom_price: true,
    monthly_price: null,
    annual_price_per_month: null,
    annual_price_per_year: null,
    monthly_allowance: '∞',
    overage_rate: null,
    features: ['unlimited_lookups', 'lookup_full', 'uptime_sla', 'support_dedicated', 'analytics', 'custom_tiers'],
  },
]

export const TAX_RATE = 0.18

export const findPlan = (code) => PUBLIC_PLANS.find((p) => p.code === code)

// Price shown at checkout for a plan + frequency (annual = full-year price,
// matching the backend order amount).
export const checkoutPrice = (plan, frequency) => {
  if (!plan || plan.custom_price) return 0
  if (frequency === 'annual') return Math.round(annualPerMonth(plan.monthly_price) * 12)
  return plan.monthly_price
}

export const breakdown = (price) => {
  const taxAmount = Math.round(price * TAX_RATE)
  return { subtotal: price, taxAmount, total: price + taxAmount }
}