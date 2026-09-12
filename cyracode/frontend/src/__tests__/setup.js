import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'
import { cyracodeStore, registrationCountStore } from './mocks/handlers'
import '../i18n'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cyracodeStore.reset()
  registrationCountStore.reset()
  localStorage.clear()
})
afterAll(() => server.close())
