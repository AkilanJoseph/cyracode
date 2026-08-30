import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import EditAddress from '../../pages/EditAddress'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../../components/MapPicker', () => ({
  default: ({ markerPosition, onLocationSelect }) => (
    <div data-testid="map-picker">
      {markerPosition && <span>Marker at {markerPosition.lat}</span>}
      <button onClick={() => onLocationSelect && onLocationSelect(12.9999, 77.1111)}>
        pick on map
      </button>
    </div>
  ),
}))

vi.mock('country-state-city/lib/state', () => ({
  default: { getStatesOfCountry: () => [{ isoCode: 'KA', name: 'Karnataka' }] },
}))

vi.mock('country-state-city/lib/city', () => ({
  default: { getCitiesOfState: () => [{ name: 'Bengaluru' }] },
}))

function setup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthProvider>
        <EditAddress />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user }
}

describe('EditAddress — dropdown', () => {
  it('loads and lists the user cyracodes in a dropdown', async () => {
    setup()
    const select = await screen.findByRole('combobox')
    expect(await screen.findByRole('option', { name: 'TestHome' })).toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })

  it('shows an immutable-name notice', async () => {
    setup()
    expect(await screen.findByText(/cannot be changed/i)).toBeInTheDocument()
  })
})

describe('EditAddress — editing flow', () => {
  it('selecting a code loads the map and lets the user continue to edit', async () => {
    const { user } = setup()
    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'code-test-id')
    expect(await screen.findByTestId('map-picker')).toBeInTheDocument()
    expect(screen.getByText(/Editing TestHome/i)).toBeInTheDocument()
  })

  it('walks through the address step and saves', async () => {
    const { user } = setup()
    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'code-test-id')
    await screen.findByTestId('map-picker')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/Street Name/i)

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText(/Street Name/i)).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(toastMock.success).toHaveBeenCalled()
    )
  })
})
