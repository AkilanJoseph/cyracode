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
  city: 'Bangalore',
  street_address: 'MG Road',
  postal_code: '560001',
  qr_code: null,
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

  // OTP
  http.post(`${BASE}/otp/send`, () =>
    HttpResponse.json({ success: true, message: 'OTP sent successfully.', expires_in: 300 })
  ),
  http.post(`${BASE}/otp/verify`, () =>
    HttpResponse.json({ success: true, message: 'OTP verified successfully.', verified: true })
  ),

  // Registration
  http.get(`${BASE}/registration/check-name/:name`, ({ params }) =>
    HttpResponse.json({ available: true, suggestions: [] })
  ),
  http.post(`${BASE}/registration/generate-code`, () =>
    HttpResponse.json({ code: 'ABC12xyz7890' })
  ),
  http.post(`${BASE}/registration/traditional`, () =>
    HttpResponse.json(mockCyraCode, { status: 201 })
  ),
  http.post(`${BASE}/registration/auto-generate`, () =>
    HttpResponse.json({ ...mockCyraCode, code_type: 'auto_generate' }, { status: 201 })
  ),
  http.get(`${BASE}/registration/my-codes`, () =>
    HttpResponse.json([mockCyraCode])
  ),

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
