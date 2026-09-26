import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { cyracodeStore } from '../mocks/handlers'
import { AuthProvider } from '../../context/AuthContext'
import ManageCyraCodes from '../../pages/ManageCyraCodes'

const MY_CODES_URL = 'http://localhost:5173/api/registration/my-codes'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

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
        <ManageCyraCodes />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user }
}

describe('ManageCyraCodes — tile list', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('loads and lists the user cyracodes as tiles', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /view/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
    expect(screen.getAllByText(/type: customized/i)).toHaveLength(2)
  })

  it('shows a notice and both registration options when there are no cyracodes', async () => {
    server.use(http.get(MY_CODES_URL, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText(/you don't have any registered cyracodes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto code/i })).toBeInTheDocument()
  })
})

describe('ManageCyraCodes — view mode', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('opens a read-only view modal with the code details', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    expect(within(modal).getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(within(modal).getByText(/MG Road, 100 Feet Road/)).toBeInTheDocument()
    expect(within(modal).getByText(/12\.971600/)).toBeInTheDocument()
    expect(within(modal).getByText('Customized')).toBeInTheDocument()
  })

  it('closes the view modal', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))
    const modal = await screen.findByTestId('view-modal')
    await user.click(within(modal).getByLabelText('Close'))
    expect(screen.queryByTestId('view-modal')).not.toBeInTheDocument()
  })

  it('displays the address in standardized order with clean formatting', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const address = within(modal).getByTestId('view-address')
    expect(address).toHaveTextContent(
      'MG Road, 100 Feet Road, Indiranagar, Bengaluru East, Bangalore, 560001, Bengaluru Urban, Karnataka, India'
    )
    expect(address.textContent).not.toMatch(/\s,/)
    expect(address.textContent).not.toMatch(/,,/)
  })

  it('copies the displayed address and confirms via toast', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const addressEl = within(modal).getByTestId('view-address')

    await user.click(within(modal).getByRole('button', { name: 'Copy address' }))

    await vi.waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Address copied to clipboard.')
    })
    // Copy always passes exactly the string the modal displays.
    expect(addressEl.textContent).toBe(
      'MG Road, 100 Feet Road, Indiranagar, Bengaluru East, Bangalore, 560001, Bengaluru Urban, Karnataka, India'
    )
  })
})

describe('ManageCyraCodes — edit flow', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('editing a code loads the map and lets the user continue', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    expect(screen.getByTestId('map-picker')).toBeInTheDocument()
  })

  it('prefills the address form with the selected code values', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    await screen.findByTestId('map-picker')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    const area = await screen.findByLabelText(/Area/i)
    expect(area).toHaveValue('Indiranagar')
    const city = screen.getByLabelText(/City/i)
    expect(city).toHaveValue('Bangalore')
    const street = screen.getByLabelText(/Street Name/i)
    expect(street).toHaveValue('MG Road')
    const town = screen.getByLabelText('Town')
    expect(town).toHaveValue('Bengaluru East')
  })

  it('walks through the address step and saves', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    await screen.findByTestId('map-picker')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/Street Name/i)

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
  })
})

describe('ManageCyraCodes — remove', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('removing a code shows a confirmation, then removes and refreshes the list', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /remove/i }))

    const modal = await screen.findByTestId('remove-modal')
    expect(within(modal).getByText(/Are you sure you want to remove TestHome/i)).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: /yes, remove/i }))
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    await screen.findByRole('heading', { name: 'MyOffice' })
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
  })

  it('cancelling the confirmation keeps the code', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /remove/i }))

    const modal = await screen.findByTestId('remove-modal')
    await user.click(within(modal).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('remove-modal')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
  })
})