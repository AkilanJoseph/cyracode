import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminCyraCodes from '../../pages/AdminCyraCodes'
import { mockAdminUser, mockToken, adminCyracodeStore } from '../mocks/handlers'

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
  default: { getCitiesOfState: () => [{ name: 'Bengaluru Urban' }] },
}))

function setup() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter>
      <AuthProvider>
        <AdminCyraCodes />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

function setupWithRoutes() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter initialEntries={['/admin/cyracodes']}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/cyracodes" element={<AdminCyraCodes />} />
          <Route path="/register/traditional" element={<div>Traditional registration screen</div>} />
          <Route path="/register/auto-generate" element={<div>Auto-generate registration screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
  adminCyracodeStore.reset()
  toastMock.success.mockClear()
  toastMock.error.mockClear()
})

describe('AdminCyraCodes', () => {
  it('lists CyraCodes with their status badges', async () => {
    setup()
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })

  it('filters the list by search query', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    const searchBox = screen.getByRole('searchbox', { name: /search by name, address, city, or country/i })
    await user.type(searchBox, 'Office')

    await waitFor(() => {
      expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
    })
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
  })

  it('filters by active status', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'false')

    await waitFor(() => {
      expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
    })
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
  })

  it('opens a registration type selection modal instead of the details form', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))

    const modal = await screen.findByTestId('registration-type-modal')
    expect(within(modal).getByText('How do you want to register?')).toBeInTheDocument()
    expect(within(modal).getByText('Choose a registration mode')).toBeInTheDocument()
    expect(within(modal).getByText('Custom Code')).toBeInTheDocument()
    expect(within(modal).getByText('Auto Code')).toBeInTheDocument()
    // The previous registration-details form is gone.
    expect(screen.queryByLabelText(/^latitude$/i)).not.toBeInTheDocument()
  })

  it('uses the same registration type icons and card layout as the dashboard', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))
    const modal = await screen.findByTestId('registration-type-modal')

    const custom = within(modal).getByTestId('reg-type-custom')
    const auto = within(modal).getByTestId('reg-type-auto')
    // Custom Code -> sparkles, Auto Code -> zap, matching Dashboard actions.
    expect(custom.querySelector('.lucide-sparkles')).not.toBeNull()
    expect(auto.querySelector('.lucide-zap')).not.toBeNull()
    // Both cards carry the dashboard card treatment plus its "Get started" CTA.
    ;[custom, auto].forEach((card) => {
      expect(card.className).toContain('rounded-2xl')
      expect(card.className).toContain('hover:-translate-y-1')
      expect(card.className).toContain('hover:shadow-card-hover')
      expect(within(card).getByText('Get started')).toBeInTheDocument()
    })
  })

  it('navigates to the traditional registration flow for Custom Code', async () => {
    const { user } = setupWithRoutes()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))
    await user.click(await screen.findByTestId('reg-type-custom'))

    expect(await screen.findByText('Traditional registration screen')).toBeInTheDocument()
  })

  it('navigates to the auto-generate registration flow for Auto Code', async () => {
    const { user } = setupWithRoutes()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))
    await user.click(await screen.findByTestId('reg-type-auto'))

    expect(await screen.findByText('Auto-generate registration screen')).toBeInTheDocument()
  })

  it('closes the selection modal without navigating when dismissed with Escape', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))
    await screen.findByTestId('registration-type-modal')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('registration-type-modal')).not.toBeInTheDocument()
    })
  })

  it('closes the selection modal when clicking outside', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))
    await screen.findByTestId('registration-type-modal')

    fireEvent.mouseDown(screen.getByTestId('registration-type-modal-overlay'))
    await waitFor(() => {
      expect(screen.queryByTestId('registration-type-modal')).not.toBeInTheDocument()
    })
  })

  it('opens the same two-step editor as Manage CyraCodes instead of redirecting', async () => {
    const { user } = setupWithRoutes()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /edit TestHome/i }))

    expect(await screen.findByRole('heading', { name: 'Edit CyraCode' })).toBeInTheDocument()
    expect(await screen.findByTestId('map-picker')).toBeInTheDocument()
    // Step 1: coordinates are prefilled from the stored record.
    expect(screen.getByText('Marker at 12.9716')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toHaveValue('12.971600')
    // The list is replaced by the editor, and no registration flow is entered.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Traditional registration screen')).not.toBeInTheDocument()
  })

  it('prefills the address form with the stored values on the second step', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /edit TestHome/i }))
    await screen.findByTestId('map-picker')
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByLabelText(/Area/i)).toHaveValue('Indiranagar')
    expect(screen.getByLabelText(/City/i)).toHaveValue('Bangalore')
    expect(screen.getByLabelText(/Street Name/i)).toHaveValue('MG Road')
    expect(screen.getByLabelText('Town')).toHaveValue('Bengaluru East')
  })

  it('saves the edited address through the admin API and returns to the list', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /edit TestHome/i }))
    await screen.findByTestId('map-picker')
    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    await screen.findByLabelText(/Street Name/i)

    const city = screen.getByLabelText(/City/i)
    await user.clear(city)
    await user.type(city, 'Bengaluru')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    await screen.findByRole('table')
    const entry = adminCyracodeStore.codes.find((c) => c.code_name === 'TestHome')
    expect(entry.city).toBe('Bengaluru')
    expect(entry.country_code).toBe('IN')
  })

  it('cancels the editor without saving and returns to the list', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /edit TestHome/i }))
    await screen.findByTestId('map-picker')
    await user.click(screen.getAllByRole('button', { name: /^cancel$/i })[0])

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByTestId('map-picker')).not.toBeInTheDocument()
    const entry = adminCyracodeStore.codes.find((c) => c.code_name === 'TestHome')
    expect(entry.city).toBe('Bangalore')
  })

  it('shows the registration type column before the status column', async () => {
    setup()
    await screen.findByText('TestHome')

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers.indexOf('Type')).toBeGreaterThan(-1)
    expect(headers.indexOf('Type')).toBeLessThan(headers.indexOf('Status'))

    const row = screen.getByText('TestHome').closest('tr')
    expect(within(row).getByText('Customized')).toBeInTheDocument()
    const officeRow = screen.getByText('MyOffice').closest('tr')
    expect(within(officeRow).getByText('Auto-generated')).toBeInTheDocument()
  })

  it('shows a details modal when viewing a code', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /view TestHome/i }))
    expect(await screen.findByText('CyraCode Details')).toBeInTheDocument()
    // Owner email appears in the table rows and in the details modal.
    expect(screen.getAllByText(/test@example.com/i).length).toBeGreaterThanOrEqual(2)
    const modal = screen.getByTestId('code-details-modal')
    expect(within(modal).getByText('Customized')).toBeInTheDocument()
  })

  it('localizes the code type in the details modal', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /view MyOffice/i }))
    expect(await screen.findByText('CyraCode Details')).toBeInTheDocument()
    const modal = screen.getByTestId('code-details-modal')
    expect(within(modal).getByText('Auto-generated')).toBeInTheDocument()
  })

  it('soft-deletes a code and flips its status to inactive', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /delete TestHome/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /delete TestHome/i })).not.toBeInTheDocument()
    })
    // Deleted codes can be restored.
    expect(screen.getByRole('button', { name: /restore TestHome/i })).toBeInTheDocument()
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(2)
  })
})