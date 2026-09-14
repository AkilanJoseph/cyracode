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

export const admin = {
  getMe: () => api.get('/admin/auth/me'),
  stats: () => api.get('/admin/stats'),
  listCyracodes: (params = {}) => api.get('/admin/cyracodes', { params }),
  getCyracode: (id) => api.get(`/admin/cyracodes/${id}`),
  createCyracode: (payload) => api.post('/admin/cyracodes', payload),
  updateCyracode: (id, payload) => api.put(`/admin/cyracodes/${id}`, payload),
  deleteCyracode: (id) => api.delete(`/admin/cyracodes/${id}`),
  restoreCyracode: (id) => api.post(`/admin/cyracodes/${id}/restore`),
  listClients: (params = {}) => api.get('/admin/clients', { params }),
  createClient: (payload) => api.post('/admin/clients', payload),
  updateClient: (id, payload) => api.put(`/admin/clients/${id}`, payload),
  deleteClient: (id) => api.delete(`/admin/clients/${id}`),
  grantPermissions: (id, permissions) => api.post(`/admin/clients/${id}/permissions`, { permissions }),
  revokePermission: (id, permission) => api.delete(`/admin/clients/${id}/permissions/${permission}`),
  rotateClientKey: (id) => api.post(`/admin/clients/${id}/rotate-key`),
  listUsers: (q = '') => api.get('/admin/users', { params: { q } }),
  updateUser: (id, payload) => api.put(`/admin/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  listAuditLogs: (params = {}) => api.get('/admin/audit-logs', { params }),
  // Billing / subscriptions (Admin Portal)
  listPlans: () => api.get('/admin/plans'),
  createPlan: (payload) => api.post('/admin/plans', payload),
  updatePlan: (code, payload) => api.put(`/admin/plans/${code}`, payload),
  deletePlan: (code) => api.delete(`/admin/plans/${code}`),
  dashboard: () => api.get('/admin/dashboard'),
  listSubscriptions: (params = {}) => api.get('/admin/subscriptions', { params }),
  setSubscription: (id, payload) => api.post(`/admin/clients/${id}/subscription`, payload),
  renewSubscription: (id, payload) => api.post(`/admin/clients/${id}/subscription/renew`, payload),
  cancelSubscription: (id) => api.post(`/admin/clients/${id}/subscription/cancel`),
}

// Authorized client integration helper — used by the Client Portal "API" demo
// to exercise the secure CyraCode address lookup with a client API key.
export const clientApi = {
  lookupAddress: (apiKey, cyracode) =>
    api.get(`/cyracode/${encodeURIComponent(cyracode)}/address`, {
      headers: { 'X-API-Key': apiKey },
    }),
}

export default api
