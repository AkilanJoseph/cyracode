import axios from 'axios'

// In dev, Vite proxies /api to VITE_BACKEND_URL. In production there is no
// proxy, so a build-time absolute URL is injected via VITE_API_BASE_URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
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

export const registration = {
  checkName: (name) => api.get(`/registration/check-name/${encodeURIComponent(name)}`),
  generateCode: (lat, lng) => api.post('/registration/generate-code', { lat, lng }),
  registrationCount: () => api.get('/registration/count'),
  // AC 6.17: idempotencyKey prevents duplicate registrations on rapid double-submit
  registerTraditional: (payload, idempotencyKey) =>
    api.post('/registration/traditional', payload, {
      headers: idempotencyKey
        ? { 'X-Idempotency-Key': idempotencyKey, Authorization: `Bearer ${localStorage.getItem('cyracode_token')}` }
        : { Authorization: `Bearer ${localStorage.getItem('cyracode_token')}` },
    }),
  registerAutoGenerate: (payload, idempotencyKey) =>
    api.post('/registration/auto-generate', payload, {
      headers: idempotencyKey
        ? { 'X-Idempotency-Key': idempotencyKey, Authorization: `Bearer ${localStorage.getItem('cyracode_token')}` }
        : { Authorization: `Bearer ${localStorage.getItem('cyracode_token')}` },
    }),
  getMyCodes: () => api.get('/registration/my-codes'),
  updateMyCode: (id, payload) => api.put(`/registration/my-codes/${id}`, payload),
  deleteMyCode: (id) => api.delete(`/registration/my-codes/${id}`),
}

export const search = {
  autocomplete: (q) => api.get(`/search/autocomplete`, { params: { q } }),
  searchByName: (name) => api.get(`/search/${encodeURIComponent(name)}`),
  reverseGeocode: (lat, lng) => api.post('/search/reverse', { lat, lng }),
}

export default api
