import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { server } from '../mocks/server'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import RegisterTraditional from '../../pages/RegisterTraditional'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../components/MapPicker', () => ({
  default: ({ onLocationSelect }) => (
    <div data-testid="map-picker">
      <button onClick={() => onLocationSelect && onLocationSelect(37.7749, -122.4194)}>
        pick on map
      </button>
    </div>
  ),
}))

vi.mock('country-state-city/lib/state', () => ({
  default: { getStatesOfCountry: () => [] },
}))

vi.mock('country-state-city/lib/city', () => ({
  default: { getCitiesOfState: () => [] },
}))

const BASE = 'http://localhost:5173/api'

function setup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ContactWidgetProvider>
        <AuthProvider>
          <RegisterTraditional />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
  return { user }
}

// The availability check is debounced by 500ms before it hits the API, so
// anything asserting on its result needs more than the default 1s budget.
const SLOW = { timeout: 4000 }

describe('RegisterTraditional — choose your CyraCode name', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    toastMock.error.mockClear()
    server.resetHandlers()
  })

  it('puts the name field above the location map', async () => {
    setup()

    const name = await screen.findByLabelText(/Choose Your CyraCode Name/i)
    const map = screen.getByTestId('map-picker')

    // The name block used to sit below the map and the coordinates, so the
    // availability result and its suggestions were the last thing read.
    expect(name.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the name hint text with the field', async () => {
    setup()

    expect(await screen.findByLabelText(/Choose Your CyraCode Name/i)).toBeInTheDocument()
    expect(screen.getByText(/Min 3 chars, letters, numbers and spaces only/i)).toBeInTheDocument()
  })

  it('confirms an available name inside the block above the map', async () => {
    const { user } = setup()
    const name = await screen.findByLabelText(/Choose Your CyraCode Name/i)

    await user.type(name, 'TestNova')

    const confirmed = await screen.findByText(/this name is available/i, {}, SLOW)
    const map = screen.getByTestId('map-picker')
    expect(confirmed.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers suggestions for a taken name', async () => {
    server.use(
      http.get(`${BASE}/registration/check-name/:name`, () =>
        HttpResponse.json({ available: false, suggestions: ['TestNovaTwo', 'TestNovaThree'] })
      )
    )
    const { user } = setup()
    const name = await screen.findByLabelText(/Choose Your CyraCode Name/i)

    await user.type(name, 'TestNova')

    expect(await screen.findByText(/this name is taken/i, {}, SLOW)).toBeInTheDocument()
    const suggestion = screen.getByRole('button', { name: 'TestNovaTwo' })
    // Picking a suggestion fills the field, which is the point of the block.
    await user.click(suggestion)
    expect(name).toHaveValue('TestNovaTwo')
  })

  it('keeps Continue disabled until a location is picked, then allows it', async () => {
    const { user } = setup()
    const continueBtn = await screen.findByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    expect(continueBtn).toBeEnabled()
  })

  it('drops characters it does not allow and shows why', async () => {
    const { user } = setup()
    const name = await screen.findByLabelText(/Choose Your CyraCode Name/i)

    // The format error is driven per keystroke, so it is only on screen while
    // the rejected character is the last one typed.
    await user.type(name, 'Test@')
    expect(await screen.findByText(/only letters, numbers, and spaces/i)).toBeInTheDocument()
    // The error replaces the hint rather than stacking with it.
    expect(screen.queryByText(/Min 3 chars, letters, numbers and spaces only/i)).not.toBeInTheDocument()
    expect(name).toHaveValue('Test')

    // Typing on clears the error and the invalid character never reaches the value.
    await user.type(name, 'Nova')
    expect(name).toHaveValue('TestNova')
    expect(screen.queryByText(/only letters, numbers, and spaces/i)).not.toBeInTheDocument()
  })

  it('leaves for the origin screen straight away when nothing has been entered', async () => {
    const { user } = setup()
    await screen.findByLabelText(/Choose Your CyraCode Name/i)

    // Cancel sits beside Continue, and is the only one on the page.
    const cancel = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancel)

    // Nothing to lose, so no prompt stands between the user and leaving.
    expect(screen.queryByTestId('discard-dialog')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('asks before discarding a name that has already been typed', async () => {
    const { user } = setup()
    const name = await screen.findByLabelText(/Choose Your CyraCode Name/i)
    await user.type(name, 'TestNova')
    await screen.findByText(/this name is available/i, {}, SLOW)

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    const dialog = await screen.findByTestId('discard-dialog')
    expect(within(dialog).getByText(/discard your changes\?/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()

    // Backing out of the prompt keeps the user on the form with their input.
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByTestId('discard-dialog')).not.toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(name).toHaveValue('TestNova')

    // Agreeing is the path that actually leaves.
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    const again = await screen.findByTestId('discard-dialog')
    await user.click(within(again).getByRole('button', { name: /yes, discard/i }))
    await waitFor(() => expect(screen.queryByTestId('discard-dialog')).not.toBeInTheDocument())
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
