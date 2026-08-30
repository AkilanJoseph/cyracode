import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, X, Loader2, MapPin, AlertTriangle, ArrowLeft } from 'lucide-react'
import Country from 'country-state-city/lib/country'
import { useTranslation } from 'react-i18next'
import ProgressSteps from '../components/common/ProgressSteps'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import MapPicker from '../components/MapPicker'
import OTPInput from '../components/OTPInput'
import { registration, otp } from '../services/api'

// Haversine distance in meters (client-side, for AC 2.17 warning)
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const POSTAL_REGEX = {
  IN: /^\d{6}$/,
  US: /^\d{5}(-\d{4})?$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
  JP: /^\d{3}-?\d{4}$/,
}

export function AddressStep({ address, setAddress, errors }) {
  const { t } = useTranslation()
  const [postalError, setPostalError] = useState('')

  // AC 2.8: Full 195+ country list (ISO 3166-1); priority countries surfaced at top
  const allCountries = Country.getAllCountries()
  const SPECIAL_CODES = ['IN', 'US', 'GB', 'JP']
  const priorityCountries = SPECIAL_CODES.map((code) => allCountries.find((c) => c.isoCode === code)).filter(Boolean)
  const remainingCountries = allCountries.filter((c) => !SPECIAL_CODES.includes(c.isoCode))

  const set = (field, value) => setAddress({ ...address, [field]: value })

  // AC 2.12: State/province dropdown — state dataset is lazy-loaded only when a
  // country is chosen so it is split into an on-demand chunk.
  const [states, setStates] = useState([])
  useEffect(() => {
    let active = true
    if (!address.country_code) {
      setStates([])
      return undefined
    }
    import('country-state-city/lib/state').then((mod) => {
      if (active) setStates(mod.default.getStatesOfCountry(address.country_code))
    })
    return () => { active = false }
  }, [address.country_code])

  // AC 2.9: District dropdown (India) — city dataset is ~7 MB, so lazy-load it
  // only when a state is selected; Vite splits it into an on-demand chunk.
  const [districts, setDistricts] = useState([])
  useEffect(() => {
    let active = true
    if (!address.country_code || !address.stateIso) {
      setDistricts([])
      return undefined
    }
    import('country-state-city/lib/city').then((mod) => {
      if (active) {
        setDistricts(mod.default.getCitiesOfState(address.country_code, address.stateIso))
      }
    })
    return () => { active = false }
  }, [address.country_code, address.stateIso])

  // AC 2.13: Real-time postal code validation
  const validatePostal = (code, countryCode) => {
    const rx = POSTAL_REGEX[countryCode]
    if (!rx || !code) return ''
    return rx.test(code.trim()) ? '' : 'Invalid postal code format for the selected country'
  }

  const handlePostalChange = (val) => {
    set('postal_code', val)
    setPostalError(validatePostal(val, address.country_code))
  }

  const handleCountryChange = (code) => {
    const c = allCountries.find((x) => x.isoCode === code)
    setAddress({ ...address, country_code: code, country: c?.name || '', state: '', stateIso: '', district: '' })
    setPostalError('')
  }

  const postalErr = postalError || errors.postal_code
  const isGenericCountry = address.country_code && !SPECIAL_CODES.includes(address.country_code)
  const selectCls = 'w-full px-3.5 py-2.5 text-sm border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-ink'

  return (
    <div className="space-y-4">
      {/* AC 2.8: 195+ ISO 3166-1 countries with common countries pinned at top */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('register.country')}</label>
        <select
          value={address.country_code}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={selectCls}
        >
          <option value="">{t('register.select_country')}</option>
          <optgroup label="Common Countries">
            {priorityCountries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
          </optgroup>
          <optgroup label="All Countries">
            {remainingCountries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
          </optgroup>
        </select>
        {errors.country_code && <p className="mt-1 text-sm text-red-500">{errors.country_code}</p>}
      </div>

      {/* AC 2.9: India — cascading State → District dropdowns */}
      {address.country_code === 'IN' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('register.state')}</label>
              <select value={address.stateIso || ''} onChange={(e) => { const s = states.find((x) => x.isoCode === e.target.value); setAddress({ ...address, stateIso: e.target.value, state: s?.name || '', district: '' }) }} className={selectCls}>
                <option value="">{t('register.select_state')}</option>
                {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('register.district')}</label>
              <select value={address.district || ''} onChange={(e) => set('district', e.target.value)} className={selectCls}>
                <option value="">{t('register.select_district')}</option>
                {districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.area')} value={address.area} onChange={(e) => set('area', e.target.value)} error={errors.area} maxLength={100} />
            <Input label={t('register.town')} value={address.town} onChange={(e) => set('town', e.target.value)} error={errors.town} maxLength={100} />
          </div>
          <Input label={t('register.road_name')} value={address.road_name} onChange={(e) => set('road_name', e.target.value)} error={errors.road_name} maxLength={100} />
          <Input label={t('register.street')} value={address.street_address} onChange={(e) => set('street_address', e.target.value)} error={errors.street_address} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.building')} value={address.building_name} onChange={(e) => set('building_name', e.target.value)} error={errors.building_name} maxLength={100} />
            <Input label={t('register.floor')} value={address.floor_unit} onChange={(e) => set('floor_unit', e.target.value)} error={errors.floor_unit} maxLength={50} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.flat_number')} value={address.flat_number} onChange={(e) => set('flat_number', e.target.value)} error={errors.flat_number} maxLength={50} />
            <Input label={t('register.plot_number')} value={address.plot_number} onChange={(e) => set('plot_number', e.target.value)} error={errors.plot_number} maxLength={50} />
          </div>
          {/* AC 2.14: Landmark optional, max 100 chars */}
          <Input label={t('register.landmark')} value={address.landmark || ''} onChange={(e) => set('landmark', e.target.value)} maxLength={100} />
          {/* AC 2.13: Real-time postal validation */}
          <Input label={t('register.postal_in')} value={address.postal_code} onChange={(e) => handlePostalChange(e.target.value)} error={postalErr} helperText={!postalErr ? t('register.postal_hint_in') : undefined} />
          <Input label={t('register.digi_pin')} value={address.digi_pin || ''} onChange={(e) => set('digi_pin', e.target.value)} error={errors.digi_pin} maxLength={10} />
        </>
      )}

      {/* AC 2.10: USA */}
      {address.country_code === 'US' && (
        <>
          <Input label={t('register.street')} value={address.street_address} onChange={(e) => set('street_address', e.target.value)} error={errors.street_address} maxLength={100} />
          <Input label={t('register.road_name')} value={address.road_name} onChange={(e) => set('road_name', e.target.value)} error={errors.road_name} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.flat_number')} value={address.flat_number} onChange={(e) => set('flat_number', e.target.value)} error={errors.flat_number} maxLength={50} />
            <Input label={t('register.plot_number')} value={address.plot_number} onChange={(e) => set('plot_number', e.target.value)} error={errors.plot_number} maxLength={50} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.area')} value={address.area} onChange={(e) => set('area', e.target.value)} error={errors.area} maxLength={100} />
            <Input label={t('register.town')} value={address.town} onChange={(e) => set('town', e.target.value)} error={errors.town} maxLength={100} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('register.state')}</label>
            <select value={address.stateIso || ''} onChange={(e) => { const s = states.find((x) => x.isoCode === e.target.value); setAddress({ ...address, stateIso: e.target.value, state: s?.name || '' }) }} className={selectCls}>
              <option value="">{t('register.select_state')}</option>
              {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
            </select>
          </div>
          <Input label={t('register.landmark')} value={address.landmark || ''} onChange={(e) => set('landmark', e.target.value)} maxLength={100} />
          <Input label={t('register.postal_us')} value={address.postal_code} onChange={(e) => handlePostalChange(e.target.value)} error={postalErr} helperText={!postalErr ? t('register.postal_hint_us') : undefined} />
        </>
      )}

      {/* AC 2.11: UK — Flat/Plot added (AC 2.15), Landmark added (AC 2.14) */}
      {address.country_code === 'GB' && (
        <>
          <Input label={t('register.building_num')} value={address.building_name} onChange={(e) => set('building_name', e.target.value)} error={errors.building_name} maxLength={100} />
          <Input label={t('register.street')} value={address.street_address} onChange={(e) => set('street_address', e.target.value)} error={errors.street_address} maxLength={100} />
          <Input label={t('register.road_name')} value={address.road_name} onChange={(e) => set('road_name', e.target.value)} error={errors.road_name} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.area')} value={address.area} onChange={(e) => set('area', e.target.value)} error={errors.area} maxLength={100} />
            <Input label={t('register.town')} value={address.town} onChange={(e) => set('town', e.target.value)} error={errors.town} maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.flat_number')} value={address.flat_number} onChange={(e) => set('flat_number', e.target.value)} error={errors.flat_number} maxLength={50} />
            <Input label={t('register.plot_number')} value={address.plot_number} onChange={(e) => set('plot_number', e.target.value)} error={errors.plot_number} maxLength={50} />
          </div>
          <Input label={t('register.floor')} value={address.floor_unit} onChange={(e) => set('floor_unit', e.target.value)} error={errors.floor_unit} maxLength={50} />
          <Input label={t('register.landmark')} value={address.landmark || ''} onChange={(e) => set('landmark', e.target.value)} maxLength={100} />
          <Input label={t('register.postal_gb')} value={address.postal_code} onChange={(e) => handlePostalChange(e.target.value)} error={postalErr} />
        </>
      )}

      {/* Japan — Landmark added (AC 2.14) */}
      {address.country_code === 'JP' && (
        <>
          <Input label={t('register.postal_jp')} value={address.postal_code} onChange={(e) => handlePostalChange(e.target.value)} error={postalErr} helperText={!postalErr ? t('register.postal_hint_jp') : undefined} />
          <Input label={t('register.prefecture')} value={address.state} onChange={(e) => set('state', e.target.value)} error={errors.state} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.area')} value={address.area} onChange={(e) => set('area', e.target.value)} error={errors.area} maxLength={100} />
            <Input label={t('register.town')} value={address.town} onChange={(e) => set('town', e.target.value)} error={errors.town} maxLength={100} />
          </div>
          <Input label={t('register.road_name')} value={address.road_name} onChange={(e) => set('road_name', e.target.value)} error={errors.road_name} maxLength={100} />
          <Input label={t('register.district_ward')} value={address.district} onChange={(e) => set('district', e.target.value)} maxLength={100} />
          <Input label={t('register.building')} value={address.building_name} onChange={(e) => set('building_name', e.target.value)} error={errors.building_name} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.flat_number')} value={address.flat_number} onChange={(e) => set('flat_number', e.target.value)} error={errors.flat_number} maxLength={50} />
            <Input label={t('register.plot_number')} value={address.plot_number} onChange={(e) => set('plot_number', e.target.value)} error={errors.plot_number} maxLength={50} />
          </div>
          <Input label={t('register.street_block')} value={address.street_address} onChange={(e) => set('street_address', e.target.value)} error={errors.street_address} maxLength={100} />
          <Input label={t('register.landmark')} value={address.landmark || ''} onChange={(e) => set('landmark', e.target.value)} maxLength={100} />
        </>
      )}

      {/* AC 2.12: All other countries — state dropdown + full fields (AC 2.14, 2.15) */}
      {isGenericCountry && (
        <>
          <Input label={t('register.street')} value={address.street_address} onChange={(e) => set('street_address', e.target.value)} error={errors.street_address} maxLength={100} />
          <Input label={t('register.road_name')} value={address.road_name} onChange={(e) => set('road_name', e.target.value)} error={errors.road_name} maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.area')} value={address.area} onChange={(e) => set('area', e.target.value)} error={errors.area} maxLength={100} />
            <Input label={t('register.town')} value={address.town} onChange={(e) => set('town', e.target.value)} error={errors.town} maxLength={100} />
          </div>
          {states.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{t('register.state_province')}</label>
              <select value={address.stateIso || ''} onChange={(e) => { const s = states.find((x) => x.isoCode === e.target.value); setAddress({ ...address, stateIso: e.target.value, state: s?.name || '' }) }} className={selectCls}>
                <option value="">{t('register.select_state')}</option>
                {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <Input label={t('register.state_province')} value={address.state} onChange={(e) => set('state', e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register.building')} value={address.building_name} onChange={(e) => set('building_name', e.target.value)} error={errors.building_name} maxLength={100} />
            <Input label={t('register.flat_number')} value={address.flat_number} onChange={(e) => set('flat_number', e.target.value)} error={errors.flat_number} maxLength={50} />
          </div>
          <Input label={t('register.plot_number')} value={address.plot_number} onChange={(e) => set('plot_number', e.target.value)} error={errors.plot_number} maxLength={50} />
          <Input label={t('register.landmark')} value={address.landmark || ''} onChange={(e) => set('landmark', e.target.value)} error={errors.landmark} maxLength={100} />
          <Input label={t('register.postal_other')} value={address.postal_code} onChange={(e) => handlePostalChange(e.target.value)} error={postalErr} maxLength={20} />
        </>
      )}
    </div>
  )
}

export function MobileStep({ mobile, setMobile, verified, setVerified }) {
  const { t, i18n } = useTranslation()
  const [otpValue, setOtpValue] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sent, setSent] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)  // UTC Date from server
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0)
  const timerRef = useRef(null)
  const expiryRef = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [cooldown])

  // Timezone: tick down OTP validity using browser local clock vs server UTC expiry
  useEffect(() => {
    if (!otpExpiresAt || verified) return
    const tick = () => {
      const remaining = Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000))
      setOtpSecondsLeft(remaining)
      if (remaining > 0) expiryRef.current = setTimeout(tick, 1000)
    }
    tick()
    return () => clearTimeout(expiryRef.current)
  }, [otpExpiresAt, verified])

  const sendOtp = async () => {
    // AC 2.18: ITU E.164 standard — ^\+?[1-9]\d{1,14}$
    if (!/^\+?[1-9]\d{1,14}$/.test(mobile.replace(/\s/g, ''))) {
      toast.error('Enter a valid mobile number in international format (e.g. +919876543210)')
      return
    }
    setSending(true)
    try {
      const { data: otpData } = await otp.sendOTP(mobile)
      toast.success('OTP sent!')
      setSent(true)
      setCooldown(30)
      // Timezone: parse UTC expiry from server; browser's Date converts to local time
      if (otpData?.expires_at) {
        setOtpExpiresAt(new Date(otpData.expires_at))
      } else {
        setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000))
      }
      setOtpSecondsLeft(300)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.otp_send_failed'))
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async () => {
    if (otpValue.length !== 4) { toast.error(t('errors.otp_six_digits')); return }
    setVerifying(true)
    try {
      await otp.verifyOTP(mobile, otpValue)
      toast.success('Mobile verified!')
      setVerified(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.otp_invalid'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-5">
      <Input
        label={t('register.mobile_label')}
        placeholder={t('register.mobile_placeholder')}
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        disabled={verified}
      />
      {!verified && (
        <>
          <Button onClick={sendOtp} loading={sending} disabled={cooldown > 0} variant="outline">
            {cooldown > 0 ? t('register.resend_wait', { n: cooldown }) : sent ? t('register.resend_otp') : t('register.send_otp')}
          </Button>
          {/* AC 2.22: explicit message when cooldown is active */}
          {cooldown > 0 && (
            <p aria-live="polite" className="text-xs text-amber-600 font-medium">{t('register.otp_cooldown')}</p>
          )}
        </>
      )}

      {sent && !verified && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 text-center">{t('register.otp_prompt', { mobile })}</p>
          {/* AC 6.15: OTP expiry in user's locale and timezone */}
          {otpSecondsLeft > 0 ? (
            <p aria-live="polite" aria-atomic="true" className="text-xs text-center text-gray-500">
              {t('register.otp_expires_at', {
                time: otpExpiresAt?.toLocaleTimeString(i18n.language),
                min: Math.floor(otpSecondsLeft / 60),
                sec: String(otpSecondsLeft % 60).padStart(2, '0'),
              })}
            </p>
          ) : (
            <p role="alert" className="text-xs text-center text-red-500 font-medium">{t('register.otp_expired')}</p>
          )}
          <OTPInput length={4} onChange={setOtpValue} />
          <Button onClick={verifyOtp} loading={verifying} disabled={otpSecondsLeft === 0} className="w-full">{t('register.verify_otp')}</Button>
        </div>
      )}

      {verified && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-sm font-medium">
          <Check className="w-4 h-4" /> {t('register.mobile_verified')}
        </div>
      )}
    </div>
  )
}

export function validateAddress(address) {
  const errors = {}
  // AC 2.16: "This field is required" for all mandatory fields
  if (!address.country_code) errors.country_code = 'This field is required'
  if (!address.street_address?.trim()) errors.street_address = 'This field is required'
  else if (address.street_address.length > 100) errors.street_address = 'Must not exceed 100 characters'
  // AC 6.22: optional field length limits
  if (address.area?.length > 100) errors.area = 'Must not exceed 100 characters'
  if (address.town?.length > 100) errors.town = 'Must not exceed 100 characters'
  if (address.road_name?.length > 100) errors.road_name = 'Must not exceed 100 characters'
  if (address.building_name?.length > 100) errors.building_name = 'Must not exceed 100 characters'
  if (address.flat_number?.length > 50) errors.flat_number = 'Must not exceed 50 characters'
  if (address.plot_number?.length > 50) errors.plot_number = 'Must not exceed 50 characters'
  if (address.floor_unit?.length > 50) errors.floor_unit = 'Must not exceed 50 characters'
  if (address.landmark?.length > 100) errors.landmark = 'Must not exceed 100 characters'
  if (address.digi_pin?.length > 10) errors.digi_pin = 'Must not exceed 10 characters'
  if (!address.postal_code?.trim()) {
    errors.postal_code = 'This field is required'
  } else {
    const rx = POSTAL_REGEX[address.country_code]
    if (rx && !rx.test(address.postal_code.trim())) {
      errors.postal_code = 'Invalid postal code format for the selected country'
    }
  }
  return errors
}

export default function RegisterTraditional() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  // AC 6.17: generate once per form session; same key used on any rapid re-submit
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random()}`
  )

  const [coords, setCoords] = useState(null)
  const [mapGeoCountry, setMapGeoCountry] = useState(null) // country from reverse geocode
  const [name, setName] = useState('')
  const [nameStatus, setNameStatus] = useState(null)
  const [nameFormatError, setNameFormatError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const debounceRef = useRef(null)

  const [address, setAddress] = useState({
    country_code: '', country: '', state: '', stateIso: '', district: '',
    city: '', area: '', town: '', road_name: '', street_address: '', building_name: '', flat_number: '', plot_number: '',
    floor_unit: '', postal_code: '', digi_pin: '', landmark: '',
  })
  const [addressErrors, setAddressErrors] = useState({})
  const [showMismatch, setShowMismatch] = useState(false)

  const [mobile, setMobile] = useState('')
  const [verified, setVerified] = useState(false)

  const STEPS = [t('register.step_location_name'), t('register.step_address'), t('register.step_verify')]

  useEffect(() => {
    if (!name || name.length < 3) { setNameStatus(null); setSuggestions([]); return }
    setNameStatus('checking')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await registration.checkName(name)
        setNameStatus(data.available ? 'available' : 'taken')
        setSuggestions(data.suggestions || [])
      } catch { setNameStatus(null) }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [name])

  // AC 2.17: Check mismatch when user changes country in step 2
  useEffect(() => {
    if (!mapGeoCountry || !address.country_code || address.country_code === 'OTHER') {
      setShowMismatch(false)
      return
    }
    setShowMismatch(address.country_code !== mapGeoCountry)
  }, [address.country_code, mapGeoCountry])

  const handleLocationSelect = (lat, lng, addr, raw) => {
    // Always accept the picked coordinate so lat/lng are prefilled.
    setCoords({ lat, lng })

    // AC 2.x / OSM (Nominatim) reverse geocoding:
    // `raw` is the Nominatim JSON payload (or null if geocoding failed).
    // A residential address requires a country component; ocean/international
    // waters have no `address.country`. If raw is null (geocode failure) or it
    // has no country, we still keep the coordinates but warn softly.
    const countryCode = raw?.address?.country_code
    if (countryCode) {
      setMapGeoCountry(countryCode.toUpperCase())
    } else {
      setMapGeoCountry(null)
    }

    if (raw && !raw.address?.country) {
      toast.error('Please select a valid residential address')
      return
    }
    if (addr) toast.success('Location selected')
  }

  const nextFromStep1 = () => {
    if (!coords) return toast.error(t('errors.select_location'))
    if (name.length < 3) return toast.error(t('errors.name_short'))
    if (nameStatus !== 'available') return toast.error(t('errors.name_unavailable'))
    setStep(2)
  }

  const nextFromStep2 = () => {
    const errors = validateAddress(address)
    setAddressErrors(errors)
    if (Object.keys(errors).length) return toast.error(t('errors.fix_fields'))
    setStep(3)
  }

  const submit = async () => {
    if (!verified) return toast.error(t('errors.verify_mobile'))
    setSubmitting(true)
    try {
      const payload = {
        name,
        latitude: coords.lat,
        longitude: coords.lng,
        country: address.country,
        country_code: address.country_code === 'OTHER' ? 'XX' : address.country_code,
        state: address.state || null,
        district: address.district || null,
        city: address.city || null,
        area: address.area || null,
        town: address.town || null,
        road_name: address.road_name || null,
        street_address: address.street_address,
        building_name: address.building_name || null,
        flat_number: address.flat_number || null,
        plot_number: address.plot_number || null,
        floor_unit: address.floor_unit || null,
        postal_code: address.postal_code,
        digi_pin: address.digi_pin || null,
        landmark: address.landmark || null,
        verified_mobile: mobile,
      }
      const { data } = await registration.registerTraditional(payload, idempotencyKeyRef.current)
      navigate('/confirmation', { state: { record: data, mode: 'traditional' } })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.register_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav aria-label={t('nav.brand')} className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-ink">{t('nav.brand')}</span>
          <span className="text-muted mx-2">/</span>
          <span className="text-sm text-muted">{t('nav.register')}</span>
        </div>
      </nav>

      <div id="main-content" className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">{t('register.title_traditional')}</h1>
          <p className="text-muted mt-1">{t('common.step_of', { current: step, total: 3, name: STEPS[step - 1] })}</p>
        </div>
        <ProgressSteps steps={STEPS} current={step} />

        <div className="bg-white rounded-3xl border border-border shadow-card p-6 sm:p-8 mt-6">
          {step === 1 && (
            <div className="space-y-5">
              <MapPicker markerPosition={coords} onLocationSelect={handleLocationSelect} />
              {/* AC 2.5 & 2.6: Read-only coordinate fields auto-populated from map */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Input
                  label="Latitude"
                  value={coords ? coords.lat.toFixed(6) : ''}
                  placeholder="Select location on map"
                  disabled
                  helperText="Auto-filled from map"
                />
                <Input
                  label="Longitude"
                  value={coords ? coords.lng.toFixed(6) : ''}
                  placeholder="Select location on map"
                  disabled
                  helperText="Auto-filled from map"
                />
              </div>
              <div>
                <Input
                  label={t('register.name_label')}
                  placeholder={t('register.name_placeholder')}
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.length > 50) {
                      setNameFormatError('Max 50 characters allowed.')
                      return
                    }
                    // International Character Support: allow Unicode letters/digits + spaces
                    if (v && !/^[\p{L}\p{N} ]*$/u.test(v)) {
                      setNameFormatError('Name must contain only letters, numbers, and spaces. Unicode characters (Hindi, Arabic, Chinese, etc.) are supported.')
                      return
                    }
                    setNameFormatError('')
                    setName(v)
                  }}
                  helperText={!nameFormatError ? t('register.name_helper') : undefined}
                  error={nameFormatError || undefined}
                  rightIcon={
                    !nameFormatError && nameStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> :
                    !nameFormatError && nameStatus === 'available' ? <Check className="w-4 h-4 text-green-500" /> :
                    !nameFormatError && nameStatus === 'taken' ? <X className="w-4 h-4 text-red-500" /> : null
                  }
                />
                {nameStatus === 'available' && (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">{t('register.name_available')}</p>
                )}
                {nameStatus === 'taken' && (
                  <div className="mt-2">
                    <p className="text-xs text-red-500 font-medium mb-1.5">{t('register.name_taken')}</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button key={s} onClick={() => setName(s)} className="text-xs px-3 py-1.5 rounded-full bg-primary-light text-primary hover:bg-teal-100 font-medium transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* AC 2.7: Disabled with tooltip until location selected */}
              <Button
                onClick={nextFromStep1}
                disabled={!coords}
                title={!coords ? 'Please select a location on the map first' : undefined}
                className="w-full"
              >
                {t('common.continue')}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {showMismatch && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{t('register.mismatch_warning')}</span>
                </div>
              )}
              <AddressStep address={address} setAddress={setAddress} errors={addressErrors} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">{t('common.back')}</Button>
                <Button onClick={nextFromStep2} className="flex-1">{t('common.continue')}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <MobileStep mobile={mobile} setMobile={setMobile} verified={verified} setVerified={setVerified} />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">{t('common.back')}</Button>
                <Button onClick={submit} loading={submitting} disabled={!verified} className="flex-1">
                  {t('register.complete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
