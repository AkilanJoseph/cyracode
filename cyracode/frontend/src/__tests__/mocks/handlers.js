import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:5173/api'

export const mockUser = {
  id: 'user-test-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_email_verified: false,
  role: 'user',
}

export const mockClientUser = {
  ...mockUser,
  id: 'client-user-test-id',
  email: 'client.user@example.com',
  first_name: 'Client',
  last_name: 'User',
  role: 'client',
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
  district: 'Bengaluru Urban',
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
  http.post(`${BASE}/auth/me/reset-password`, () =>
    HttpResponse.json({ message: 'A password reset link has been sent to your registered email address.' })
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
  http.post(`${BASE}/registration/suggest-names`, () =>
    HttpResponse.json({
      names: [
        { name: 'TestNova', category: '🌌 Space' },
        { name: 'TestBloom', category: '🌸 Flowers' },
        { name: 'TestFalcon', category: '🐦 Birds' },
        { name: 'TestWillow', category: '🌿 Nature' },
        { name: 'TestOrion', category: '🌌 Space' },
        { name: 'TestPhoenix', category: '🔮 Mythical' },
        { name: 'TestMystic', category: '✨ Fantasy' },
        { name: 'TestZenith', category: '🌙 Cosmic' },
        { name: 'TestCoral', category: '🌊 Ocean' },
        { name: 'TestEmber', category: '🔥 Elements' },
      ],
    })
  ),
  http.post(`${BASE}/registration/personalized`, () => {
    registrationCountStore.actualCount += 1
    return HttpResponse.json({ ...mockCyraCode, code_name: 'TestNova', code_type: 'personalized' }, { status: 201 })
  }),
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

// ---------- Admin portal ----------

export const mockAdminUser = {
  ...mockUser,
  id: 'admin-test-id',
  email: 'admin@example.com',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin',
  is_admin: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

export const adminStatsStore = {
  stats: {
    total_cyracodes: 2,
    active_cyracodes: 2,
    flagged_cyracodes: 0,
    total_clients: 1,
    active_clients: 1,
    total_users: 3,
  },
  reset() {
    this.stats = {
      total_cyracodes: 2,
      active_cyracodes: 2,
      flagged_cyracodes: 0,
      total_clients: 1,
      active_clients: 1,
      total_users: 3,
    }
  },
}

const seedAdminCodes = () => [
  { ...mockCyraCode, owner_name: 'Test User', owner_email: 'test@example.com', is_active: true },
  { ...mockCyraCode, id: 'code-test-id-2', code_name: 'MyOffice', code_type: 'auto_generate', is_active: false, owner_email: 'test@example.com' },
]

export const adminCyracodeStore = {
  codes: seedAdminCodes(),
  reset() {
    this.codes = seedAdminCodes()
  },
}

const seedClients = () => [
  {
    id: 'client-1',
    name: 'Courier Partner',
    key_tail: 'Ab12',
    contact_email: 'integrations@courier.example',
    is_active: true,
    permissions: ['cyracode.lookup'],
    created_at: '2026-01-02T00:00:00Z',
    subscription_id: 'sub-1',
    plan_code: 'basic',
    plan_name: 'Basic',
    monthly_cost: 500,
    subscription_start: '2026-01-02T00:00:00Z',
    expiry_date: '2026-12-31T00:00:00Z',
    subscription_status: 'active',
  },
]

export const adminClientStore = {
  clients: seedClients(),
  reset() {
    this.clients = seedClients()
  },
}

const seedPlans = () => [
  { code: 'basic', name: 'Basic', monthly_cost: 500 },
  { code: 'pro', name: 'Pro', monthly_cost: 2000 },
  { code: 'enterprise', name: 'Enterprise', monthly_cost: 5000 },
]

export const adminPlanStore = {
  plans: seedPlans(),
  reset() {
    this.plans = seedPlans()
  },
}

export const adminDashboardStore = {
  data: {
    total_clients: 1,
    active_clients: 1,
    total_subscriptions: 1,
    active_subscriptions: 1,
    expiring_soon: 0,
    monthly_recurring_revenue: 500,
    renewal_rate: 100,
    api_calls_24h: 12,
    api_issues_24h: 0,
    revenue_trend: [
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 500 },
      { month: 'Mar', amount: 500 },
    ],
    subscriptions_by_plan: [{ name: 'Basic', clients: 1 }],
    recent_transactions: [
      {
        id: 'tx-1',
        client_name: 'Courier Partner',
        plan_name: 'Basic',
        amount: 500,
        status: 'paid',
        created_at: '2026-02-01T00:00:00Z',
      },
    ],
  },
  reset() {
    this.data = {
      total_clients: 1,
      active_clients: 1,
      total_subscriptions: 1,
      active_subscriptions: 1,
      expiring_soon: 0,
      monthly_recurring_revenue: 500,
      renewal_rate: 100,
      api_calls_24h: 12,
      api_issues_24h: 0,
      revenue_trend: [
        { month: 'Jan', amount: 0 },
        { month: 'Feb', amount: 500 },
        { month: 'Mar', amount: 500 },
      ],
      subscriptions_by_plan: [{ name: 'Basic', clients: 1 }],
      recent_transactions: [
        {
          id: 'tx-1',
          client_name: 'Courier Partner',
          plan_name: 'Basic',
          amount: 500,
          status: 'paid',
          created_at: '2026-02-01T00:00:00Z',
        },
      ],
    }
  },
}

const seedUsers = () => [
  { ...mockAdminUser },
  {
    ...mockUser,
    id: 'user-client-1',
    email: 'client@example.com',
    first_name: 'Client',
    role: 'client',
    is_admin: false,
    is_active: true,
    created_at: '2026-01-03T00:00:00Z',
  },
]

export const adminUserStore = {
  users: seedUsers(),
  reset() {
    this.users = seedUsers()
  },
}

export const adminAuditStore = {
  logs: [
    {
      id: 'audit-1',
      user_id: 'admin-test-id',
      user_email: 'admin@example.com',
      action: 'admin_login',
      ip_address: '127.0.0.1',
      created_at: '2026-09-13T10:00:00Z',
    },
    {
      id: 'audit-2',
      user_id: 'admin-test-id',
      user_email: 'admin@example.com',
      action: 'cyracode_create:TestHome',
      ip_address: '127.0.0.1',
      created_at: '2026-09-13T11:00:00Z',
    },
  ],
  reset() {
    this.logs = [
      {
        id: 'audit-1',
        user_id: 'admin-test-id',
        user_email: 'admin@example.com',
        action: 'admin_login',
        ip_address: '127.0.0.1',
        created_at: '2026-09-13T10:00:00Z',
      },
      {
        id: 'audit-2',
        user_id: 'admin-test-id',
        user_email: 'admin@example.com',
        action: 'cyracode_create:TestHome',
        ip_address: '127.0.0.1',
        created_at: '2026-09-13T11:00:00Z',
      },
    ]
  },
}

export const adminHandlers = [
  http.get(`${BASE}/admin/auth/me`, () => HttpResponse.json(mockAdminUser)),
  http.get(`${BASE}/admin/stats`, () => HttpResponse.json(adminStatsStore.stats)),

  http.get(`${BASE}/admin/cyracodes`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase()
    const isActive = url.searchParams.get('is_active')
    let items = adminCyracodeStore.codes
    if (q) {
      items = items.filter((c) => c.code_name.toLowerCase().includes(q))
    }
    if (isActive === 'true') items = items.filter((c) => c.is_active)
    if (isActive === 'false') items = items.filter((c) => !c.is_active)
    return HttpResponse.json({ items, total: items.length, page: 1, page_size: 20 })
  }),
  http.get(`${BASE}/admin/cyracodes/:id`, ({ params }) => {
    const entry = adminCyracodeStore.codes.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'CyraCode not found.' }, { status: 404 })
    return HttpResponse.json({ ...entry, area: entry.area, state: entry.state })
  }),
  http.post(`${BASE}/admin/cyracodes`, async ({ request }) => {
    const body = await request.json()
    const entry = {
      id: `code-${Date.now()}`,
      code_name: body.name,
      code_type: 'traditional',
      latitude: body.latitude,
      longitude: body.longitude,
      country: body.country,
      country_code: body.country_code,
      state: body.state || null,
      city: body.city || null,
      area: body.area || null,
      street_address: body.street_address,
      postal_code: body.postal_code,
      is_active: true,
      owner_name: 'Admin User',
      owner_email: 'admin@example.com',
      created_at: new Date().toISOString(),
    }
    adminCyracodeStore.codes = [entry, ...adminCyracodeStore.codes]
    return HttpResponse.json(entry, { status: 201 })
  }),
  http.put(`${BASE}/admin/cyracodes/:id`, async ({ params, request }) => {
    const entry = adminCyracodeStore.codes.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'CyraCode not found.' }, { status: 404 })
    const body = await request.json()
    Object.assign(entry, body)
    return HttpResponse.json(entry)
  }),
  http.delete(`${BASE}/admin/cyracodes/:id`, ({ params }) => {
    const entry = adminCyracodeStore.codes.find((c) => c.id === params.id)
    if (entry) entry.is_active = false
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${BASE}/admin/cyracodes/:id/restore`, ({ params }) => {
    const entry = adminCyracodeStore.codes.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'CyraCode not found.' }, { status: 404 })
    entry.is_active = true
    return HttpResponse.json(entry)
  }),

  http.get(`${BASE}/admin/clients`, () => HttpResponse.json(adminClientStore.clients)),
  http.post(`${BASE}/admin/clients`, async ({ request }) => {
    const body = await request.json()
    const client = {
      id: `client-${Date.now()}`,
      name: body.name,
      key_tail: 'Ze9k',
      contact_email: body.contact_email || null,
      is_active: true,
      permissions: body.permissions || [],
      created_at: new Date().toISOString(),
    }
    adminClientStore.clients = [client, ...adminClientStore.clients]
    return HttpResponse.json({ client, api_key: 'cyra_test_generated_key_12345678' }, { status: 201 })
  }),
  http.put(`${BASE}/admin/clients/:id`, async ({ params, request }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    const body = await request.json()
    if (body.name !== undefined) entry.name = body.name
    if (body.contact_email !== undefined) entry.contact_email = body.contact_email
    if (body.is_active !== undefined) entry.is_active = body.is_active
    return HttpResponse.json(entry)
  }),
  http.delete(`${BASE}/admin/clients/:id`, ({ params }) => {
    adminClientStore.clients = adminClientStore.clients.filter((c) => c.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${BASE}/admin/clients/:id/permissions`, async ({ params, request }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    const body = await request.json()
    const perms = new Set(entry.permissions)
    ;(body.permissions || []).forEach((p) => perms.add(p))
    entry.permissions = [...perms]
    return HttpResponse.json(entry)
  }),
  http.delete(`${BASE}/admin/clients/:id/permissions/:permission`, ({ params }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    entry.permissions = entry.permissions.filter((p) => p !== params.permission)
    return HttpResponse.json(entry)
  }),
  http.post(`${BASE}/admin/clients/:id/rotate-key`, ({ params }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    entry.key_tail = 'Rot8'
    return HttpResponse.json({ client: entry, api_key: 'cyra_test_rotated_key_abcdef' })
  }),

  http.get(`${BASE}/admin/plans`, () => HttpResponse.json(adminPlanStore.plans)),
  http.post(`${BASE}/admin/plans`, async ({ request }) => {
    const body = await request.json()
    const code = String(body.code).toLowerCase()
    if (adminPlanStore.plans.some((p) => p.code === code)) {
      return HttpResponse.json({ detail: 'A plan with this code already exists.' }, { status: 409 })
    }
    const plan = { id: `plan-${Date.now()}`, code, name: body.name, monthly_cost: body.monthly_cost }
    adminPlanStore.plans.push(plan)
    return HttpResponse.json(plan, { status: 201 })
  }),
  http.put(`${BASE}/admin/plans/:code`, async ({ params, request }) => {
    const entry = adminPlanStore.plans.find((p) => p.code === params.code)
    if (!entry) return HttpResponse.json({ detail: 'Plan not found.' }, { status: 404 })
    const body = await request.json()
    if (body.name !== undefined) entry.name = body.name
    if (body.monthly_cost !== undefined) entry.monthly_cost = body.monthly_cost
    return HttpResponse.json(entry)
  }),
  http.delete(`${BASE}/admin/plans/:code`, ({ params }) => {
    const entry = adminPlanStore.plans.find((p) => p.code === params.code)
    if (!entry) return HttpResponse.json({ detail: 'Plan not found.' }, { status: 404 })
    const inUse = adminClientStore.clients.some((c) => c.plan_code === params.code)
    if (inUse) {
      return HttpResponse.json({ detail: 'Plan is still in use.' }, { status: 409 })
    }
    adminPlanStore.plans = adminPlanStore.plans.filter((p) => p.code !== params.code)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${BASE}/admin/dashboard`, () => HttpResponse.json(adminDashboardStore.data)),
  http.get(`${BASE}/admin/subscriptions`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    let items = adminClientStore.clients
      .filter((c) => c.subscription_status)
      .map((c) => ({
        id: c.subscription_id,
        client_id: c.id,
        client_name: c.name,
        plan_code: c.plan_code,
        plan_name: c.plan_name,
        monthly_cost: c.monthly_cost,
        start_date: c.subscription_start,
        end_date: c.expiry_date,
        status: c.subscription_status,
        is_active: c.is_active,
      }))
    if (status) items = items.filter((s) => s.status === status)
    return HttpResponse.json({ items, total: items.length, page, page_size: pageSize })
  }),
  http.post(`${BASE}/admin/clients/:id/subscription`, async ({ params, request }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    const body = await request.json()
    const plan = adminPlanStore.plans.find((p) => p.code === body.plan) || adminPlanStore.plans[0]
    entry.plan_code = plan.code
    entry.plan_name = plan.name
    entry.monthly_cost = plan.monthly_cost
    entry.subscription_status = 'active'
    entry.subscription_start = new Date().toISOString()
    entry.subscription_id = entry.subscription_id || 'sub-new'
    const end = new Date()
    end.setMonth(end.getMonth() + Number(body.months || 12))
    entry.expiry_date = end.toISOString()
    return HttpResponse.json(entry)
  }),
  http.post(`${BASE}/admin/clients/:id/subscription/renew`, async ({ params, request }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    const body = await request.json()
    entry.subscription_status = 'active'
    const end = new Date(entry.expiry_date || Date.now())
    end.setMonth(end.getMonth() + Number(body.months || 12))
    entry.expiry_date = end.toISOString()
    return HttpResponse.json(entry)
  }),
  http.post(`${BASE}/admin/clients/:id/subscription/cancel`, ({ params }) => {
    const entry = adminClientStore.clients.find((c) => c.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'API client not found.' }, { status: 404 })
    entry.subscription_status = 'cancelled'
    return HttpResponse.json(entry)
  }),

  http.get(`${BASE}/admin/users`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase()
    let items = adminUserStore.users
    if (q) {
      items = items.filter((u) => u.email.toLowerCase().includes(q) || u.first_name.toLowerCase().includes(q))
    }
    return HttpResponse.json({ items, total: items.length })
  }),
  http.put(`${BASE}/admin/users/:id`, async ({ params, request }) => {
    const entry = adminUserStore.users.find((u) => u.id === params.id)
    if (!entry) return HttpResponse.json({ detail: 'User not found.' }, { status: 404 })
    const body = await request.json()
    if (body.role !== undefined) {
      entry.role = body.role
      entry.is_admin = body.role === 'admin'
    }
    if (body.is_admin !== undefined) {
      entry.is_admin = body.is_admin
      entry.role = body.is_admin ? 'admin' : 'user'
    }
    if (body.is_active !== undefined) entry.is_active = body.is_active
    return HttpResponse.json(entry)
  }),
  http.delete(`${BASE}/admin/users/:id`, ({ params }) => {
    const entry = adminUserStore.users.find((u) => u.id === params.id)
    if (entry) entry.is_active = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE}/admin/audit-logs`, ({ request }) => {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    let items = adminAuditStore.logs
    if (action) items = items.filter((l) => l.action === action)
    return HttpResponse.json({ items, total: items.length })
  }),
]

// ---------- Authorized client lookup (X-API-Key) ----------

const seedLookupKeys = () => ({
  'cyra_test_lookup_key_0001': { clientName: 'Courier Partner', permissions: ['cyracode.lookup'] },
  'cyra_test_no_access_key_0002': { clientName: 'Read Only Co', permissions: [] },
})

export const clientLookupStore = {
  validKeys: seedLookupKeys(),
  reset() {
    this.validKeys = seedLookupKeys()
  },
}

const lookupAddress = {
  cyracode: 'TestHome',
  address: {
    address_line1: 'MG Road',
    address_line2: 'Indiranagar, 100 Feet Road',
    city: 'Bangalore',
    state: 'Karnataka',
    postal_code: '560001',
    country: 'India',
  },
}

// ---------- Public billing (self-serve plans & checkout) ----------

const seedBillingPlans = () => [
  { code: 'sandbox', name: 'Sandbox', sort: 0, featured: false, custom_price: false, monthly_price: 0, monthly_allowance: '1,000', overage_rate: null, features: ['up_to_1k', 'lookup_basic', 'support_community'], annual_price_per_month: 0, annual_price_per_year: 0 },
  { code: 'developer', name: 'Developer', sort: 1, featured: false, custom_price: false, monthly_price: 29, monthly_allowance: '100,000', overage_rate: '0.020', features: ['up_to_100k', 'lookup_full', 'uptime_sla', 'support_standard'], annual_price_per_month: 23, annual_price_per_year: 276 },
  { code: 'growth', name: 'Growth', sort: 2, featured: true, custom_price: false, monthly_price: 99, monthly_allowance: '1,000,000', overage_rate: '0.010', features: ['up_to_1m', 'lookup_full', 'uptime_sla', 'support_priority', 'analytics'], annual_price_per_month: 79, annual_price_per_year: 948 },
  { code: 'scale', name: 'Scale', sort: 3, featured: false, custom_price: false, monthly_price: 349, monthly_allowance: '10,000,000', overage_rate: '0.004', features: ['up_to_10m', 'lookup_full', 'uptime_sla', 'support_priority', 'analytics', 'dedicated_engineer'], annual_price_per_month: 279, annual_price_per_year: 3348 },
  { code: 'enterprise', name: 'Enterprise', sort: 4, featured: false, custom_price: true, monthly_price: null, monthly_allowance: '∞', overage_rate: null, features: ['unlimited_lookups', 'lookup_full', 'uptime_sla', 'support_dedicated', 'analytics', 'custom_tiers'], annual_price_per_month: null, annual_price_per_year: null },
]

const seedBillingOrders = () => [
  {
    id: 'order-growth-1',
    order_no: 'CYRA-TEST01',
    email: 'test@example.com',
    plan_code: 'growth',
    plan_name: 'Growth',
    billing_frequency: 'annual',
    amount: 948,
    tax_amount: 171,
    total_amount: 1119,
    currency: 'USD',
    status: 'paid',
    payment_method: 'card',
    auto_renew: true,
    promo_code: null,
    client_id: 'bill-client-1',
    created_at: '2026-08-15T09:30:00Z',
    updated_at: '2026-08-15T09:30:00Z',
  },
  {
    id: 'order-dev-2',
    order_no: 'CYRA-TEST02',
    email: 'test@example.com',
    plan_code: 'developer',
    plan_name: 'Developer',
    billing_frequency: 'monthly',
    amount: 29,
    tax_amount: 5,
    total_amount: 34,
    currency: 'USD',
    status: 'cancelled',
    payment_method: 'upi',
    auto_renew: false,
    promo_code: null,
    client_id: 'bill-client-2',
    created_at: '2026-07-01T11:00:00Z',
    updated_at: '2026-07-01T11:00:00Z',
  },
]

export const billingStore = {
  plans: seedBillingPlans(),
  orders: seedBillingOrders(),
  idempotency: {},
  reset() {
    this.plans = seedBillingPlans()
    this.orders = seedBillingOrders()
    this.idempotency = {}
  },
}

export const billingHandlers = [
  http.get(`${BASE}/billing/plans`, () => HttpResponse.json(billingStore.plans)),

  http.get(`${BASE}/billing/orders`, ({ request }) => {
    const url = new URL(request.url)
    const email = (url.searchParams.get('email') || '').trim().toLowerCase()
    const orders = billingStore.orders.filter((o) => o.email === email)
    return HttpResponse.json(orders)
  }),

  http.get(`${BASE}/billing/orders/:id`, ({ params }) => {
    const order = billingStore.orders.find((o) => o.id === params.id)
    if (!order) return HttpResponse.json({ detail: 'Order not found.' }, { status: 404 })
    return HttpResponse.json(order)
  }),

  http.post(`${BASE}/billing/orders`, async ({ request }) => {
    const key = request.headers.get('X-Idempotency-Key')
    if (key && billingStore.idempotency[key]) {
      const order = billingStore.orders.find((o) => o.id === billingStore.idempotency[key])
      if (order) return HttpResponse.json({ ...order, api_key: null }, { status: 201 })
    }
    const body = await request.json()
    const plan = billingStore.plans.find((p) => p.code === body.plan_code)
    if (!plan || plan.custom_price) {
      return HttpResponse.json({ detail: 'This plan is not available for checkout.' }, { status: 422 })
    }
    const price = body.billing_frequency === 'annual' ? plan.annual_price_per_year : plan.monthly_price
    if (!price) return HttpResponse.json({ detail: 'This plan is free and does not require checkout.' }, { status: 422 })
    const tax = Math.round(price * 0.18)
    const order = {
      id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_no: `CYRA-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      email: body.email.trim().toLowerCase(),
      plan_code: plan.code,
      plan_name: plan.name,
      billing_frequency: body.billing_frequency,
      amount: price,
      tax_amount: tax,
      total_amount: price + tax,
      currency: 'USD',
      status: 'paid',
      payment_method: body.payment_method || null,
      auto_renew: true,
      promo_code: body.promo_code || null,
      client_id: `bill-client-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    billingStore.orders = [order, ...billingStore.orders]
    if (key) billingStore.idempotency[key] = order.id
    return HttpResponse.json({ ...order, api_key: 'cyra_test_selfserve_key_9999' }, { status: 201 })
  }),

  http.post(`${BASE}/billing/orders/:id/cancel`, ({ params }) => {
    const order = billingStore.orders.find((o) => o.id === params.id)
    if (!order) return HttpResponse.json({ detail: 'Order not found.' }, { status: 404 })
    if (order.status !== 'paid') {
      return HttpResponse.json({ detail: 'This order has already been cancelled.' }, { status: 409 })
    }
    order.status = 'cancelled'
    order.auto_renew = false
    order.updated_at = new Date().toISOString()
    return HttpResponse.json(order)
  }),

  http.patch(`${BASE}/billing/orders/:id/auto-renew`, async ({ params, request }) => {
    const order = billingStore.orders.find((o) => o.id === params.id)
    if (!order) return HttpResponse.json({ detail: 'Order not found.' }, { status: 404 })
    const body = await request.json()
    order.auto_renew = Boolean(body.auto_renew)
    order.updated_at = new Date().toISOString()
    return HttpResponse.json(order)
  }),
]

export const clientLookupHandlers = [
  http.get(`${BASE}/cyracode/:code/address`, ({ request, params }) => {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return HttpResponse.json(
        { detail: 'Authentication required: provide an X-API-Key header.' },
        { status: 401 }
      )
    }
    const cred = clientLookupStore.validKeys[apiKey]
    if (!cred) {
      return HttpResponse.json({ detail: 'Invalid or inactive API key.' }, { status: 401 })
    }
    if (!cred.permissions.includes('cyracode.lookup')) {
      return HttpResponse.json(
        { detail: 'This client is not authorized to use the CyraCode address lookup API.' },
        { status: 403 }
      )
    }
    if (String(params.code).toLowerCase() !== 'testhome') {
      return HttpResponse.json({ detail: 'CyraCode not found.' }, { status: 404 })
    }
    return HttpResponse.json(lookupAddress)
  }),
]

export const allHandlers = [...handlers, ...adminHandlers, ...billingHandlers, ...clientLookupHandlers]
