import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:5173/api'

export const mockUser = {
  id: 'user-test-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_email_verified: false,
}

export const mockToken = 'mock-jwt-token'

export const mockCyraCode = {
  id: 'code-test-id',
  code_name: 'TestHome',
  code_type: 'traditional',
  latitude: 12.9716,
  longitude: 77.5946,
  country: 'India',
  country_code: 'IN',
  state: 'Karnataka',
  area: 'Indiranagar',
  town: 'Bengaluru East',
  road_name: '100 Feet Road',
  city: 'Bangalore',
  street_address: 'MG Road',
  postal_code: '560001',
  qr_code: null,
}

const seedCodes = () => [
  { ...mockCyraCode },
  { ...mockCyraCode, id: 'code-test-id-2', code_name: 'MyOffice', area: 'Koramangala' },
]

export const cyracodeStore = {
  codes: seedCodes(),
  reset() {
    this.codes = seedCodes()
  },
}

export const registrationCountStore = {
  initialCount: 10000,
  actualCount: 100,
  reset() {
    this.initialCount = 10000
    this.actualCount = 100
  },
  displayCount() {
    return this.initialCount + this.actualCount
  },
}

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json({ access_token: mockToken, token_type: 'bearer', user: mockUser }, { status: 201 })
  ),
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ access_token: mockToken, token_type: 'bearer', user: mockUser })
  ),
  http.post(`${BASE}/auth/forgot-password`, () =>
    HttpResponse.json({ message: 'If an account exists for this email, a reset link has been sent.' })
  ),
  http.post(`${BASE}/auth/google`, () =>
    HttpResponse.json({ access_token: mockToken, token_type: 'bearer', user: mockUser })
  ),
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json(mockUser)
  ),

  // Registration
  http.get(`${BASE}/registration/count`, () =>
    HttpResponse.json({
      initial_count: registrationCountStore.initialCount,
      actual_count: registrationCountStore.actualCount,
      display_count: registrationCountStore.displayCount(),
    })
  ),
  http.get(`${BASE}/registration/check-name/:name`, ({ params }) =>
    HttpResponse.json({ available: true, suggestions: [] })
  ),
  http.post(`${BASE}/registration/generate-code`, () =>
    HttpResponse.json({ code: 'ABC12xyz7890' })
  ),
  http.post(`${BASE}/registration/traditional`, () => {
    registrationCountStore.actualCount += 1
    return HttpResponse.json(mockCyraCode, { status: 201 })
  }),
  http.post(`${BASE}/registration/auto-generate`, () => {
    registrationCountStore.actualCount += 1
    return HttpResponse.json({ ...mockCyraCode, code_type: 'auto_generate' }, { status: 201 })
  }),
  http.get(`${BASE}/registration/my-codes`, () =>
    HttpResponse.json(cyracodeStore.codes)
  ),
  http.put(`${BASE}/registration/my-codes/:id`, ({ params }) => {
    const entry = cyracodeStore.codes.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'CyraCode not found.' }, { status: 404 })
    return HttpResponse.json({ ...entry, street_address: 'Edited Road' })
  }),
  http.delete(`${BASE}/registration/my-codes/:id`, ({ params }) => {
    cyracodeStore.codes = cyracodeStore.codes.filter((c) => c.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Search
  http.get(`${BASE}/search/autocomplete`, () =>
    HttpResponse.json([{ name: 'TestHome', address: 'MG Road, Bangalore, India' }])
  ),
  http.get(`${BASE}/search/:name`, () =>
    HttpResponse.json({
      name: 'TestHome',
      code_type: 'traditional',
      latitude: 12.9716,
      longitude: 77.5946,
      full_address: 'MG Road, Bangalore, India',
      postal_code: '560001',
      country: 'India',
      city: 'Bangalore',
    })
  ),
  http.post(`${BASE}/search/reverse`, () =>
    HttpResponse.json({
      name: 'NearCode',
      code_type: 'traditional',
      latitude: 12.9716,
      longitude: 77.5946,
      full_address: 'MG Road, Bangalore, India',
      postal_code: '560001',
      country: 'India',
      city: 'Bangalore',
    })
  ),
]
