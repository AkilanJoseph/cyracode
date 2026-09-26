import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CreditCard, Landmark, Smartphone, ShieldCheck, Lock, CheckCircle2,
  Copy, Check, ArrowRight, Loader2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import Header from '../components/common/Header'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import { useAuth } from '../context/AuthContext'
import { billing } from '../services/api'
import { apiErrorMessage } from '../utils/errors'
import { PUBLIC_PLANS, breakdown, checkoutPrice } from '../lib/plans'
import { COUNTRIES, EMPTY_ADDRESS, ADDRESS_FIELDS, cloneAddress, isAddressEmpty, isPostalValid, isStateRequired } from '../lib/address'

const METHODS = ['card', 'debit', 'netbanking', 'upi']

const BANKS = [
  'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank',
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Yes Bank',
  'Union Bank of India', 'Bank of Baroda', 'Indian Bank',
]

const methodIcon = {
  card: CreditCard,
  debit: CreditCard,
  netbanking: Landmark,
  upi: Smartphone,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UPI_RE = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/
const PHONE_RE = /^[6-9]\d{9}$/

function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  if (/^(6[0-5]|8[0-7]1)/.test(digits)) return 'rupay'
  if (/^3[47]/.test(digits)) return 'amex'
  return null
}

function formatCardNumber(value, brand) {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  if (brand === 'amex') {
    const groups = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean)
    return groups.join(' ')
  }
  const groups = digits.match(/.{1,4}/g) || []
  return groups.join(' ').slice(0, 23)
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

// Deterministic simulated payment gateway used until a real PSP is wired up.
// Numbers ending in 0002 → insufficient funds; 0003 → expired card.
function gatewayResult(method, data) {
  const digits = (data.number || '').replace(/\D/g, '')
  if (digits.endsWith('0002')) return { ok: false, reason: 'insufficient' }
  if (digits.endsWith('0003')) return { ok: false, reason: 'expired' }
  return { ok: true }
}

function money(n) {
  return `$${n.toLocaleString('en-US')}`
}

function AddressSection({ ns, label, values, onChange, onCountryChange, errors, disabled }) {
  const { t } = useTranslation()
  const editable = !disabled
  const country = values.country
  return (
    <div className="rounded-2xl border border-border p-5 space-y-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <Input
        id={`${ns}-company`}
        label={t('payment.addr_company')}
        placeholder={t('payment.addr_company_placeholder')}
        value={values.company}
        onChange={(e) => onChange('company', e.target.value)}
        error={errors[`${ns}_company`]}
        disabled={!editable}
      />
      <Input
        id={`${ns}-addr1`}
        label={t('payment.addr_line1')}
        placeholder={t('payment.addr_line1_placeholder')}
        value={values.addr1}
        onChange={(e) => onChange('addr1', e.target.value)}
        error={errors[`${ns}_addr1`]}
        disabled={!editable}
      />
      <Input
        id={`${ns}-addr2`}
        label={t('payment.addr_line2_optional')}
        placeholder={t('payment.addr_line2_placeholder')}
        value={values.addr2}
        onChange={(e) => onChange('addr2', e.target.value)}
        error={errors[`${ns}_addr2`]}
        disabled={!editable}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={`${ns}-city`}
          label={t('payment.addr_city')}
          placeholder={t('payment.addr_city_placeholder')}
          value={values.city}
          onChange={(e) => onChange('city', e.target.value)}
          error={errors[`${ns}_city`]}
          disabled={!editable}
        />
        <Input
          id={`${ns}-state`}
          label={t(`payment.addr_state${isStateRequired(country) ? '_required' : ''}`)}
          placeholder={t('payment.addr_state_placeholder')}
          value={values.state}
          onChange={(e) => onChange('state', e.target.value)}
          error={errors[`${ns}_state`]}
          disabled={!editable}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={`${ns}-postal`}
          label={t('payment.addr_postal')}
          inputMode="numeric"
          placeholder={t('payment.addr_postal_placeholder')}
          value={values.postal}
          onChange={(e) => onChange('postal', e.target.value.replace(/\s/g, ''))}
          error={errors[`${ns}_postal`]}
          disabled={!editable}
        />
        <div>
          <label htmlFor={`${ns}-country`} className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            {t('payment.addr_country')}
          </label>
          <select
            id={`${ns}-country`}
            value={values.country}
            onChange={(e) => onCountryChange(e.target.value)}
            disabled={!editable}
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            <option value="">{t('payment.addr_country_placeholder')}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          {errors[`${ns}_country`] && <p className="mt-1 text-xs text-red-500">{errors[`${ns}_country`]}</p>}
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const planCode = searchParams.get('plan') || ''
  const billingFreq = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'

  const plan = useMemo(() => PUBLIC_PLANS.find((p) => p.code === planCode), [planCode])

  const [method, setMethod] = useState('card')
  const [email, setEmail] = useState(user?.email || '')
  const [promo, setPromo] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(null)

  const [card, setCard] = useState({ holder: '', number: '', expiry: '', cvv: '' })
  const [bank, setBank] = useState('')
  const [upi, setUpi] = useState({ id: '', phone: '' })

  const [invoiceAddr, setInvoiceAddr] = useState(cloneAddress(EMPTY_ADDRESS))
  const [billingAddr, setBillingAddr] = useState(cloneAddress(EMPTY_ADDRESS))
  const [sameAsInvoice, setSameAsInvoice] = useState(false)

  const [errors, setErrors] = useState({})
  const [processing, setProcessing] = useState(false)
  const [failures, setFailures] = useState(0)
  const [locked, setLocked] = useState(false)
  const [lockUntil, setLockUntil] = useState(null)
  const [success, setSuccess] = useState(null)

  const brand = detectCardBrand(card.number.replace(/\D/g, ''))
  const price = plan ? checkoutPrice(plan, billingFreq) : 0
  const summary = breakdown(price)
  const emailPrefilled = Boolean(email)

  // No valid plan → back to pricing.
  if (!plan) {
    return (
      <div className="min-h-screen bg-surface">
        <Header maxWidth="max-w-6xl" marketingNav />
        <main id="main-content" className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-muted">{t('payment.no_plan')}</p>
          <Link to="/pricing" className="mt-4 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
            {t('common.continue')}
          </Link>
        </main>
      </div>
    )
  }

  const validate = () => {
    const e = {}
    if (!email.trim()) e.email = t('common.required')
    else if (!EMAIL_RE.test(email.trim())) e.email = t('payment.err_email')

    const validateAddress = (addr, ns) => {
      const a = {}
      if (!String(addr.company).trim()) a[`${ns}_company`] = t('common.required')
      if (!String(addr.addr1).trim()) a[`${ns}_addr1`] = t('common.required')
      if (!String(addr.city).trim()) a[`${ns}_city`] = t('common.required')
      if (isStateRequired(addr.country) && !String(addr.state).trim()) a[`${ns}_state`] = t('common.required')
      if (!String(addr.postal).trim()) a[`${ns}_postal`] = t('common.required')
      else if (addr.country && !isPostalValid(addr.postal, addr.country)) a[`${ns}_postal`] = t('payment.err_postal')
      if (!addr.country) a[`${ns}_country`] = t('common.required')
      Object.assign(e, a)
    }

    validateAddress(invoiceAddr, 'invoice')
    if (!sameAsInvoice) validateAddress(billingAddr, 'billing')

    if (method === 'card' || method === 'debit') {
      if (!card.holder.trim()) e.holder = t('common.required')
      const digits = card.number.replace(/\D/g, '')
      if (!digits) e.number = t('common.required')
      else if (digits.length < 15 || digits.length > 19) e.number = t('payment.err_card_number')
      if (!card.expiry.trim()) e.expiry = t('common.required')
      else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) e.expiry = t('payment.err_expiry_format')
      if (!card.cvv.trim()) e.cvv = t('common.required')
      else if (!new RegExp(brand === 'amex' ? /^\d{4}$/ : /^\d{3}$/).test(card.cvv)) e.cvv = t('payment.err_cvv')
    } else if (method === 'netbanking') {
      if (!bank) e.bank = t('payment.err_bank')
    } else if (method === 'upi') {
      if (!upi.id.trim()) e.upiId = t('common.required')
      else if (!UPI_RE.test(upi.id.trim())) e.upiId = t('payment.err_upi')
      if (!upi.phone.trim()) e.upiPhone = t('common.required')
      else if (!PHONE_RE.test(upi.phone.trim())) e.upiPhone = t('payment.err_phone')
    }
    return e
  }

  const billingSnapshotRef = useRef(null)

  const patchInvoice = (field, value) => {
    setInvoiceAddr((prev) => ({ ...prev, [field]: value }))
    // Keep billing in sync while "same as invoice" is enabled (AC: synchronized).
    if (sameAsInvoice) setBillingAddr((prev) => ({ ...prev, [field]: value }))
  }

  const patchBilling = (field, value) => {
    setBillingAddr((prev) => ({ ...prev, [field]: value }))
  }

  const handleInvoiceCountry = (code) => {
    setInvoiceAddr((prev) => ({ ...prev, country: code }))
    if (sameAsInvoice) setBillingAddr((prev) => ({ ...prev, country: code }))
    // A new country immediately re-bases postal/state validation.
    setErrors((prev) => {
      const next = { ...prev }
      delete next.invoice_postal
      delete next.invoice_state
      if (sameAsInvoice) {
        delete next.billing_postal
        delete next.billing_state
      }
      return next
    })
  }

  const copyInvoiceIntoBilling = (prevBilling) => {
    const next = { ...prevBilling }
    for (const f of ADDRESS_FIELDS) {
      if (String(invoiceAddr[f]).trim()) next[f] = invoiceAddr[f]
    }
    return next
  }

  const handleSameAsInvoice = (checked) => {
    if (checked) {
      // Snapshot the billing values so unchecking can restore them (AC: preserve
      // previously entered values). Then copy every populated invoice field over.
      billingSnapshotRef.current = !isAddressEmpty(billingAddr) ? cloneAddress(billingAddr) : null
      setBillingAddr((prev) => copyInvoiceIntoBilling(prev))
    } else {
      const snapshot = billingSnapshotRef.current
      billingSnapshotRef.current = null
      setBillingAddr((prev) => (snapshot ? snapshot : prev))
    }
    setSameAsInvoice(checked)
    setErrors((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (k.startsWith('billing_')) delete next[k]
      }
      return next
    })
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (processing || locked) return

    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      toast.error(t('payment.err_fix_fields'))
      return
    }

    const sim = gatewayResult(method, { number: card.number.replace(/\D/g, '') })
    if (!sim.ok) {
      const nextFailures = failures + 1
      setFailures(nextFailures)
      toast.error(t(`payment.err_${sim.reason}`))
      if (nextFailures >= 3) {
        const until = Date.now() + 60 * 1000
        setLocked(true)
        setLockUntil(until)
        setTimeout(() => { setLocked(false); setLockUntil(null); setFailures(0) }, 60 * 1000)
      }
      return
    }

    setProcessing(true)
    try {
      const payload = {
        email: email.trim(),
        plan_code: planCode,
        billing_frequency: billingFreq,
        payment_method: method,
        promo_code: appliedPromo || undefined,
      }
      // Same key for the whole checkout session → a retry after a network
      // blip can never create a duplicate order.
      const checkpointId = `checkout:${planCode}:${billingFreq}:${email.trim().toLowerCase()}`
      const [resp] = await Promise.all([
        billing.placeOrder(payload, checkpointId),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
      setSuccess(resp.data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast.error(apiErrorMessage(err, t('payment.err_generic')))
    } finally {
      setProcessing(false)
    }
  }

  // ---- Success ---- //
  if (success) {
    return (
      <div className="min-h-screen bg-surface">
        <Header maxWidth="max-w-6xl" marketingNav />
        <main id="main-content" className="max-w-2xl mx-auto px-4 py-14 animate-fade-in-up">
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-card text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-ink">{t('payment.success_title')}</h1>
            <p className="mt-1 text-muted text-sm">{t('payment.email_sent_note')}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-surface px-4 py-3">
                <dt className="text-xs text-muted">{t('payment.order_no')}</dt>
                <dd className="font-bold text-ink mt-0.5">{success.order_no}</dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3">
                <dt className="text-xs text-muted">{t('payment.total_charged')}</dt>
                <dd className="font-bold text-ink mt-0.5">{money(success.total_amount)}</dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3">
                <dt className="text-xs text-muted">{t('payment.plan')}</dt>
                <dd className="font-bold text-ink mt-0.5">{success.plan_name}</dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3">
                <dt className="text-xs text-muted">{t('payment.billing_frequency')}</dt>
                <dd className="font-bold text-ink mt-0.5">{t(`payment.${success.billing_frequency}`)}</dd>
              </div>
            </dl>

            {success.api_key && (
              <div className="mt-5 rounded-2xl border border-primary/25 bg-primary-light/40 p-5 text-left">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t('payment.api_key_label')}</p>
                <p className="text-xs text-muted mt-0.5">{t('payment.api_key_once')}</p>
                <CopyText value={success.api_key} />
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to={`/orders?email=${encodeURIComponent(success.email)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                {t('payment.view_orders')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
              >
                {t('payment.back_to_pricing')}
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-6xl" marketingNav />

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Payment form */}
        <section className="bg-white rounded-3xl border border-border shadow-card p-6 md:p-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-ink">{t('payment.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('payment.subtitle')}</p>

          {/* Method tabs */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label={t('payment.methods_label')}>
            {METHODS.map((m) => {
              const Icon = methodIcon[m]
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => setMethod(m)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-all ${
                    method === m ? 'border-primary bg-primary-light/60 text-primary' : 'border-border text-muted hover:border-primary/40 hover:text-ink'
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {t(`payment.method_${m}`)}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="rounded-2xl border border-border p-5 space-y-4">
              <p className="text-sm font-semibold text-ink">{t('payment.billing_details')}</p>
              <Input
                id="pay-email"
                label={t('payment.email')}
                type="email"
                placeholder={t('payment.email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
              />
              {emailPrefilled && (
                <p className="text-xs text-muted -mt-2">{t('payment.email_prefilled')}</p>
              )}
            </div>

            {/* Invoice address (below the email field) */}
            <AddressSection
              ns="invoice"
              label={t('payment.invoice_address')}
              values={invoiceAddr}
              onChange={patchInvoice}
              onCountryChange={handleInvoiceCountry}
              errors={errors}
              disabled={false}
            />

            {/* "Billing address is same as invoice address" checkbox */}
            <label
              className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                sameAsInvoice ? 'border-primary bg-primary-light/40' : 'border-border hover:border-primary/40'
              }`}
            >
              <input
                type="checkbox"
                checked={sameAsInvoice}
                onChange={(e) => handleSameAsInvoice(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
              <span className="text-sm text-ink">{t('payment.bill_same_as_invoice')}</span>
            </label>

            {/* Billing address */}
            <AddressSection
              ns="billing"
              label={t('payment.billing_address')}
              values={sameAsInvoice ? invoiceAddr : billingAddr}
              onChange={patchBilling}
              onCountryChange={(code) => {
                setBillingAddr((prev) => ({ ...prev, country: code }))
                setErrors((prev) => {
                  const next = { ...prev }
                  delete next.billing_postal
                  delete next.billing_state
                  return next
                })
              }}
              errors={errors}
              disabled={sameAsInvoice}
            />

            {(method === 'card' || method === 'debit') && (
              <div className="rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{t(`payment.${method}_tab`)}</p>
                  {brand && (
                    <span className="rounded-full bg-surface border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
                      {brand}
                    </span>
                  )}
                </div>
                <Input
                  id="pay-holder"
                  label={t('payment.card_holder')}
                  placeholder="Jane Doe"
                  value={card.holder}
                  onChange={(e) => setCard({ ...card, holder: e.target.value })}
                  error={errors.holder}
                />
                <Input
                  id="pay-number"
                  label={t('payment.card_number')}
                  inputMode="numeric"
                  placeholder="4111 1111 1111 1111"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value, brand) })}
                  error={errors.number}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="pay-expiry"
                    label={t('payment.expiry')}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                    error={errors.expiry}
                  />
                  <Input
                    id="pay-cvv"
                    label={t('payment.cvv')}
                    placeholder="•••"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={card.cvv}
                    onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })}
                    error={errors.cvv}
                  />
                </div>
              </div>
            )}

            {method === 'netbanking' && (
              <div className="rounded-2xl border border-border p-5 space-y-4">
                <p className="text-sm font-semibold text-ink">{t('payment.netbanking_tab')}</p>
                <div>
                  <label htmlFor="pay-bank" className="block text-sm font-medium text-ink mb-1.5">
                    {t('payment.bank_label')}
                  </label>
                  <select
                    id="pay-bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">{t('payment.bank_placeholder')}</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {errors.bank && <p className="mt-1 text-xs text-red-500">{errors.bank}</p>}
                </div>
                <p className="text-xs text-muted">{t('payment.netbanking_redirect_note')}</p>
              </div>
            )}

            {method === 'upi' && (
              <div className="rounded-2xl border border-border p-5 space-y-4">
                <p className="text-sm font-semibold text-ink">{t('payment.upi_tab')}</p>
                <Input
                  id="pay-upi-id"
                  label={t('payment.upi_id')}
                  placeholder="name@okaxis"
                  value={upi.id}
                  onChange={(e) => setUpi({ ...upi, id: e.target.value })}
                  error={errors.upiId}
                />
                <Input
                  id="pay-upi-phone"
                  label={t('payment.phone')}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={upi.phone}
                  onChange={(e) => setUpi({ ...upi, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  error={errors.upiPhone}
                />
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {upi.id.trim() && (
                    <div className="rounded-xl border border-border p-3 bg-white">
                      <QRCodeSVG
                        value={`upi://pay?pa=${encodeURIComponent(upi.id.trim())}&pn=CyraCode&am=${price}&cu=USD`}
                        size={128}
                        level="M"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted sm:max-w-[16rem]">{t('payment.upi_qr_note')}</p>
                </div>
              </div>
            )}

            {locked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t('payment.locked')}</span>
              </div>
            )}

            <Button type="submit" loading={processing} disabled={locked} size="lg" className="w-full">
              {processing ? t('payment.processing') : t(`payment.pay_${method}`)}
            </Button>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" aria-hidden="true" /> {t('payment.sec_tls')}</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" aria-hidden="true" /> {t('payment.sec_pci')}</span>
              <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" aria-hidden="true" /> {t('payment.sec_tokenized')}</span>
            </div>
            <p className="text-center text-[11px] text-muted">
              {t('payment.legal_1')}{' '}
              <Link to="/privacy" className="underline text-primary">{t('payment.privacy_link')}</Link>{' '}
              {t('payment.legal_2')}
            </p>
          </form>
        </section>

        {/* Order summary */}
        <aside className="bg-white rounded-3xl border border-border shadow-card p-6 sticky top-20">
          <h2 className="text-lg font-bold text-ink">{t('payment.summary_title')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t('payment.plan')}</dt>
              <dd className="font-semibold text-ink">{plan.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t('payment.billing_frequency')}</dt>
              <dd className="font-medium text-ink capitalize">{t(`payment.${billingFreq}`)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t('payment.starts_today')}</dt>
              <dd className="font-medium text-ink">{t('payment.today')}</dd>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <dt className="text-muted">{t('payment.subtotal')}</dt>
              <dd className="font-medium text-ink">{money(summary.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t('payment.taxes')}</dt>
              <dd className="font-medium text-ink">{money(summary.taxAmount)}</dd>
            </div>
            <div className="border-t border-border pt-3 flex justify-between items-baseline">
              <dt className="font-semibold text-ink">{t('payment.total_due')}</dt>
              <dd className="text-xl font-extrabold text-primary">{money(summary.total)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-2">
            <input
              type="text"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder={t('payment.promo_placeholder')}
              className="flex-1 rounded-xl border border-border px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => {
                if (promo.trim()) { setAppliedPromo(promo.trim().toUpperCase()); toast.success(t('payment.promo_applied')); }
              }}
              className="rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
            >
              {t('payment.apply')}
            </button>
          </div>
          {appliedPromo && (
            <p className="mt-2 text-xs text-emerald-600">{t('payment.promo_used', { code: appliedPromo })}</p>
          )}

          <div className="mt-6 space-y-2 text-xs text-muted">
            <p className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> {t('payment.instantly_active')}</p>
            <p className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> {t('payment.receipt_emailed')}</p>
          </div>
        </aside>
      </main>
    </div>
  )
}

function CopyText({ value }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-white border border-border px-3 py-2">
      <code className="flex-1 text-sm text-ink break-all">{value}</code>
      <button type="button" onClick={copy} aria-label={t('payment.copy_api_key')} className="text-primary hover:text-primary-dark transition-colors">
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  )
}