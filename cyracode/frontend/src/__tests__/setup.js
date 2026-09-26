import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'
import {
  adminAuditStore,
  adminClientStore,
  adminCyracodeStore,
  adminStatsStore,
  adminUserStore,
  billingStore,
  clientLookupStore,
  cyracodeStore,
  registrationCountStore,
} from './mocks/handlers'
import '../i18n'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cyracodeStore.reset()
  registrationCountStore.reset()
  adminStatsStore.reset()
  adminCyracodeStore.reset()
  adminClientStore.reset()
  adminUserStore.reset()
  adminAuditStore.reset()
  billingStore.reset()
  clientLookupStore.reset()
  localStorage.clear()
})
afterAll(() => server.close())
