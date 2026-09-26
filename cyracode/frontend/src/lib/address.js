// Country-aware address helpers for the payment checkout form.
// Postal formats and state/province requirements follow a per-country rule set
// matching the CyraCode spec's "international address handling" guidance.

export const ADDRESS_FIELDS = ['company', 'addr1', 'addr2', 'city', 'state', 'postal', 'country']

export const EMPTY_ADDRESS = {
  company: '',
  addr1: '',
  addr2: '',
  city: '',
  state: '',
  postal: '',
  country: '',
}

export const COUNTRIES = [
  { code: 'US', name: 'United States', postal: /^\d{5}(-\d{4})?$/, stateRequired: true },
  { code: 'CA', name: 'Canada', postal: /^[ABCEGHJKLMNPRSTVXY]\d[A-Z] ?\d[A-Z]\d$/, stateRequired: true },
  { code: 'MX', name: 'Mexico', postal: /^\d{5}$/, stateRequired: true },
  { code: 'GB', name: 'United Kingdom', postal: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, stateRequired: false },
  { code: 'DE', name: 'Germany', postal: /^\d{5}$/, stateRequired: false },
  { code: 'FR', name: 'France', postal: /^\d{5}$/, stateRequired: false },
  { code: 'ES', name: 'Spain', postal: /^\d{5}$/, stateRequired: false },
  { code: 'IT', name: 'Italy', postal: /^\d{5}$/, stateRequired: false },
  { code: 'NL', name: 'Netherlands', postal: /^\d{4}\s?[A-Z]{2}$/i, stateRequired: false },
  { code: 'CH', name: 'Switzerland', postal: /^\d{4}$/, stateRequired: false },
  { code: 'SE', name: 'Sweden', postal: /^\d{3}\s?\d{2}$/, stateRequired: false },
  { code: 'NO', name: 'Norway', postal: /^\d{4}$/, stateRequired: false },
  { code: 'DK', name: 'Denmark', postal: /^\d{4}$/, stateRequired: false },
  { code: 'FI', name: 'Finland', postal: /^\d{5}$/, stateRequired: false },
  { code: 'PL', name: 'Poland', postal: /^\d{2}-\d{3}$/, stateRequired: false },
  { code: 'CZ', name: 'Czechia', postal: /^\d{3}\s?\d{2}$/, stateRequired: false },
  { code: 'AE', name: 'United Arab Emirates', postal: /^\d{0,5}$/, stateRequired: false },
  { code: 'SA', name: 'Saudi Arabia', postal: /^\d{5}$/, stateRequired: false },
  { code: 'IN', name: 'India', postal: /^\d{6}$/, stateRequired: true },
  { code: 'AU', name: 'Australia', postal: /^\d{4}$/, stateRequired: true },
  { code: 'NZ', name: 'New Zealand', postal: /^\d{4}$/, stateRequired: false },
  { code: 'SG', name: 'Singapore', postal: /^\d{6}$/, stateRequired: false },
  { code: 'JP', name: 'Japan', postal: /^\d{3}-\d{4}$/, stateRequired: false },
  { code: 'KR', name: 'South Korea', postal: /^\d{5}$/, stateRequired: false },
  { code: 'CN', name: 'China', postal: /^\d{6}$/, stateRequired: true },
  { code: 'BR', name: 'Brazil', postal: /^\d{5}-?\d{3}$/, stateRequired: true },
  { code: 'AR', name: 'Argentina', postal: /^[A-Z]\d{4}[A-Z]{3}$/, stateRequired: false },
  { code: 'CL', name: 'Chile', postal: /^\d{7}$/, stateRequired: false },
  { code: 'CO', name: 'Colombia', postal: /^\d{6}$/, stateRequired: false },
  { code: 'KE', name: 'Kenya', postal: /^\d{5}$/, stateRequired: false },
  { code: 'NG', name: 'Nigeria', postal: /^\d{6}$/, stateRequired: false },
  { code: 'ZA', name: 'South Africa', postal: /^\d{4}$/, stateRequired: false },
  { code: 'UA', name: 'Ukraine', postal: /^\d{5}$/, stateRequired: false },
  { code: 'TR', name: 'Turkey', postal: /^\d{5}$/, stateRequired: false },
  { code: 'ID', name: 'Indonesia', postal: /^\d{5}$/, stateRequired: false },
  { code: 'MY', name: 'Malaysia', postal: /^\d{5}$/, stateRequired: false },
  { code: 'PH', name: 'Philippines', postal: /^\d{4}$/, stateRequired: false },
  { code: 'TH', name: 'Thailand', postal: /^\d{5}$/, stateRequired: false },
  { code: 'VN', name: 'Vietnam', postal: /^\d{6}$/, stateRequired: false },
  { code: 'EG', name: 'Egypt', postal: /^\d{5}$/, stateRequired: false },
  { code: 'IL', name: 'Israel', postal: /^\d{5,7}$/, stateRequired: false },
]

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || null
}

export function isPostalValid(value, countryCode) {
  const country = getCountry(countryCode)
  if (!country) return true // no rule → accept any non-empty value at form level
  return country.postal.test((value || '').trim())
}

export function isStateRequired(countryCode) {
  const country = getCountry(countryCode)
  return Boolean(country && country.stateRequired)
}

export function requiresPostal(countryCode) {
  const country = getCountry(countryCode)
  return Boolean(country || !countryCode)
}

export function cloneAddress(addr) {
  return { ...EMPTY_ADDRESS, ...addr }
}

export function isAddressEmpty(addr) {
  return ADDRESS_FIELDS.every((f) => !String(addr?.[f] || '').trim())
}