import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterTraditional from '../../pages/RegisterTraditional'
import RegisterAutoGenerate from '../../pages/RegisterAutoGenerate'
import Confirmation from '../../pages/Confirmation'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import {
  ADMIN_MAX_WIDTH,
  ADMIN_PADDING_Y,
  APP_MAX_WIDTH,
  APP_PADDING_Y,
  frameForOrigin,
} from '../../lib/layout'

vi.mock('../../components/MapPicker', () => ({
  default: () => <div data-testid="map-picker" />,
}))

const record = {
  id: 'code-id',
  code_name: 'MyTestCode',
  code_type: 'traditional',
  latitude: 12.9716,
  longitude: 77.5946,
  country: 'India',
  country_code: 'IN',
  state: 'Karnataka',
  city: 'Bangalore',
  postal_code: '560001',
}

// Step 1 of each flow, then the completion screen it hands off to. The frame has
// to survive the whole route, not just the screen the admin first lands on.
const FLOWS = [
  ['register with custom name', '/register/traditional', <RegisterTraditional key="r" />],
  ['auto generate', '/register/auto-generate', <RegisterAutoGenerate key="a" />],
  ['completion', '/confirmation', <Confirmation key="c" />],
]

function renderAt(path, ui, state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <ContactWidgetProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
}

function contentClass(ui, state) {
  const { container, unmount } = renderAt('/register/traditional', ui, state)
  const main = document.getElementById('main-content') || container.querySelector('.animate-fade-in-up')
  const className = main ? main.className : null
  unmount()
  return className
}

describe('frameForOrigin', () => {
  it('gives the admin frame to a flow entered from admin', () => {
    expect(frameForOrigin({ fromAdmin: true })).toEqual({
      maxWidth: ADMIN_MAX_WIDTH,
      paddingY: ADMIN_PADDING_Y,
      isAdmin: true,
    })
  })

  it('falls back to the app frame for every other entry point', () => {
    // Dashboard, landing and pricing send no flag at all.
    expect(frameForOrigin(undefined)).toEqual({
      maxWidth: APP_MAX_WIDTH,
      paddingY: APP_PADDING_Y,
      isAdmin: false,
    })
    expect(frameForOrigin({ fromAdmin: false }).maxWidth).toBe(APP_MAX_WIDTH)
    // A truthy non-boolean must not be mistaken for the admin entry point.
    expect(frameForOrigin({ fromAdmin: 'yes' }).maxWidth).toBe(APP_MAX_WIDTH)
  })
})

describe('registration screens entered from admin', () => {
  it.each(FLOWS)('%s keeps the admin width and padding', (_name, path, ui) => {
    const state = path === '/confirmation' ? { record, fromAdmin: true } : { fromAdmin: true }
    const className = contentClass(ui, state)

    expect(className).toContain(ADMIN_MAX_WIDTH)
    expect(className).toContain(ADMIN_PADDING_Y)
    // And is no longer the narrower app frame the same screen uses elsewhere.
    expect(className).not.toContain(APP_MAX_WIDTH)
    expect(className).not.toContain(APP_PADDING_Y)
  })

  it.each(FLOWS)('%s header and footer line up with the admin width', (_name, path, ui) => {
    const state = path === '/confirmation' ? { record, fromAdmin: true } : { fromAdmin: true }
    const { container, unmount } = renderAt(path, ui, state)

    const header = container.querySelector('nav > div')
    const footer = container.querySelector('footer > div')
    expect(header.className).toContain(ADMIN_MAX_WIDTH)
    expect(footer.className).toContain(ADMIN_MAX_WIDTH)
    // Still responsive: one fluid column that the viewport, not the frame, drives.
    expect(header.className).toContain('mx-auto')
    expect(header.className).toContain('px-4')

    unmount()
  })

  // A wider frame must not turn any paired field into a fixed two-column grid,
  // which is what would break the wizard on a phone.
  it.each(FLOWS)('%s has no grid locked to two columns', (_name, path, ui) => {
    const state = path === '/confirmation' ? { record, fromAdmin: true } : { fromAdmin: true }
    const { container, unmount } = renderAt(path, ui, state)

    const locked = [...container.querySelectorAll('.grid-cols-2')].filter(
      (el) => !el.classList.contains('grid-cols-1')
    )
    expect(locked.map((el) => el.className)).toEqual([])

    unmount()
  })
})

describe('registration screens entered from anywhere else', () => {
  it.each(FLOWS)('%s keeps the app frame when not entered from admin', (_name, path, ui) => {
    const state = path === '/confirmation' ? { record } : undefined
    const className = contentClass(ui, state)

    expect(className).toContain(APP_MAX_WIDTH)
    expect(className).toContain(APP_PADDING_Y)
    expect(className).not.toContain(ADMIN_MAX_WIDTH)
  })
})