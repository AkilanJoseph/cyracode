import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cyracode_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error)
  }
)

export const auth = {
  login: (email, password, remember_me = false) =>
    api.post('/auth/login', { email, password, remember_me }),
  register: (first_name, last_name, email, password, gdpr_consent = false) =>
    api.post('/auth/register', { first_name, last_name, email, password, gdpr_consent }),
  googleAuth: (token) => api.post('/auth/google', { token }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  deleteAccount: () => api.delete('/auth/me'),
  getMe: () => api.get('/auth/me'),
}

export const otp = {
  sendOTP: (mobile) => api.post('/otp/send', { mobile }),
  verifyOTP: (mobile, otp) => api.post('/otp/verify', { mobile, otp }),
}

export const registration = {
  checkName: (name) => api.get(`/registration/check-name/${encodeURIComponent(name)}`),
  generateCode: (lat, lng) => api.post('/registration/generate-code', { lat, lng }),
  // AC 6.17: idempotencyKey prevents duplicate registrations on rapid double-submit
  registerTraditional: (payload, idempotencyKey) =>
    api.post('/registration/traditional', payload, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
    }),
  registerAutoGenerate: (payload, idempotencyKey) =>
    api.post('/registration/auto-generate', payload, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
    }),
  getMyCodes: () => api.get('/registration/my-codes'),
}

export const search = {
  autocomplete: (q) => api.get(`/search/autocomplete`, { params: { q } }),
  searchByName: (name) => api.get(`/search/${encodeURIComponent(name)}`),
  reverseGeocode: (lat, lng) => api.post('/search/reverse', { lat, lng }),
}

export default api
