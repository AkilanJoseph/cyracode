import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterTraditional, { AddressStep } from '../../pages/RegisterTraditional'
import RegisterAutoGenerate from '../../pages/RegisterAutoGenerate'
import ManageCyraCodes from '../../pages/ManageCyraCodes'
import { Dashboard } from '../../App'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import { APP_MAX_WIDTH, APP_PADDING_Y } from '../../lib/layout'

vi.mock('../../components/MapPicker', () => ({
  default: () => <div data-testid="map-picker" />,
}))

function renderAt(path, ui) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ContactWidgetProvider>{ui}</ContactWidgetProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

const SCREENS = [
  ['dashboard', '/dashboard', <Dashboard key="d" />],
  ['register with custom name', '/register', <RegisterTraditional key="r" />],
  ['auto generate', '/register/auto-generate', <RegisterAutoGenerate key="a" />],
  ['manage cyracodes', '/manage', <ManageCyraCodes key="m" />],
]

describe('signed-in screen frame', () => {
  // These screens each hand-wrote their own width, so the registration forms
  // rendered narrower (max-w-2xl) than the dashboard that lists what they create.
  it.each(SCREENS)('%s uses the dashboard width and padding', (_name, path, ui) => {
    renderAt(path, ui)

    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main).toHaveClass(APP_MAX_WIDTH, 'mx-auto', 'px-4', APP_PADDING_Y)
    // The narrower frame these screens used to carry.
    expect(main).not.toHaveClass('max-w-2xl')
    expect(main).not.toHaveClass('py-10')
  })

  it.each(SCREENS)('%s header and footer share the same width', (_name, path, ui) => {
    const { container, unmount } = renderAt(path, ui)

    // Header and Footer render the shared width on their inner container, which
    // sits inside <nav>/<footer>; matching classes is what keeps edges aligned.
    const header = container.querySelector('nav > div')
    const footer = container.querySelector('footer > div')
    expect(header.className).toContain(APP_MAX_WIDTH)
    expect(footer.className).toContain(APP_MAX_WIDTH)

    unmount()
  })

  // The skip link in the layout points at #main-content. Only Dashboard uses a
  // <main> element; the rest use a plain div, so this checks the id, not a role.
  it.each(SCREENS)('%s exposes the skip-link target', (_name, path, ui) => {
    renderAt(path, ui)

    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main).toHaveClass(APP_MAX_WIDTH)
  })

  // No grid may be locked to two columns at every viewport width. Both
  // `grid-cols-1 sm:grid-cols-2` and a bare `sm:grid-cols-2` satisfy this; only a
  // bare `grid-cols-2` is the bug, since it cannot collapse on a phone.
  it.each(SCREENS)('%s has no grid locked to two columns', (_name, path, ui) => {
    const { container, unmount } = renderAt(path, ui)

    const locked = [...container.querySelectorAll('.grid-cols-2')].filter(
      (el) => !el.classList.contains('grid-cols-1')
    )
    expect(locked.map((el) => el.className)).toEqual([])

    unmount()
  })
})

// AddressStep is shared by both registration flows and both editors, so its
// paired fields are checked directly rather than through a screen that may or
// may not have the relevant step open.
describe('AddressStep responsiveness', () => {
  it('collapses every paired field below sm', () => {
    // India is the only country with cascading dropdowns, so pick it to bring
    // the widest set of paired grids into the tree.
    render(
      <AddressStep
        address={{
          country_code: 'IN',
          country: 'India',
          stateIso: '',
          state: '',
          district: '',
          area: '',
          city: '',
          street: '',
          town: '',
          postal_code: '',
        }}
        setAddress={vi.fn()}
        errors={{}}
      />
    )

    const pairs = [...document.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-2')]
    expect(pairs.length).toBeGreaterThan(0)
    pairs.forEach((grid) => expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2'))

    const locked = [...document.querySelectorAll('.grid-cols-2')].filter(
      (el) => !el.classList.contains('grid-cols-1')
    )
    expect(locked.map((el) => el.className)).toEqual([])
  })
})
