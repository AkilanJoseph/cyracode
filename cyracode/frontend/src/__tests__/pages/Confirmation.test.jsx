import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import Confirmation from '../../pages/Confirmation'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockRecord = {
  id: 'code-id',
  code_name: 'MyTestCode',
  code_type: 'traditional',
  latitude: 12.9716,
  longitude: 77.5946,
  country: 'India',
  country_code: 'IN',
  state: 'Karnataka',
  city: 'Bangalore',
  street_address: 'MG Road',
  building_name: 'Test Building',
  flat_plot_number: '10A',
  postal_code: '560001',
}

function renderWithRecord(record = mockRecord) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/confirmation', state: { record, mode: 'traditional' } }]}
    >
      <AuthProvider>
        <Routes>
          <Route path="/confirmation" element={<Confirmation />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Confirmation page — with record', () => {
  it('displays the CyraCode name prominently', () => {
    renderWithRecord()
    expect(screen.getByText('MyTestCode')).toBeInTheDocument()
  })

  it('renders QR code canvas', () => {
    renderWithRecord()
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('displays address in a readable format', () => {
    renderWithRecord()
    expect(screen.getByText(/MG Road/)).toBeInTheDocument()
    expect(screen.getByText(/Bangalore/)).toBeInTheDocument()
  })

  it('shows latitude and longitude', () => {
    renderWithRecord()
    expect(screen.getByText(/12\.971/)).toBeInTheDocument()
    expect(screen.getByText(/77\.594/)).toBeInTheDocument()
  })

  it('renders Download QR button', () => {
    renderWithRecord()
    expect(screen.getByRole('button', { name: /download qr/i })).toBeInTheDocument()
  })

  it('renders WhatsApp share button', () => {
    renderWithRecord()
    expect(screen.getByText(/whatsapp/i)).toBeInTheDocument()
  })

  it('renders Email share button', () => {
    renderWithRecord()
    expect(screen.getByText(/email/i)).toBeInTheDocument()
  })

  it('renders Copy Link button', () => {
    renderWithRecord()
    expect(screen.getByText(/copy link/i)).toBeInTheDocument()
  })

  it('renders Go to Dashboard link', () => {
    renderWithRecord()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders Search CyraCodes link', () => {
    renderWithRecord()
    expect(screen.getByRole('link', { name: /search cyracodes/i })).toBeInTheDocument()
  })

  it('copy link writes to clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })
    renderWithRecord()
    await user.click(screen.getByText(/copy link/i).closest('button'))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('MyTestCode'))
  })

  it('shows congratulations message', () => {
    renderWithRecord()
    expect(screen.getByText(/congratulations/i)).toBeInTheDocument()
  })

  it('handles null optional fields gracefully', () => {
    const sparseRecord = {
      ...mockRecord,
      building_name: null,
      flat_plot_number: null,
      landmark: null,
      district: null,
      state: null,
    }
    renderWithRecord(sparseRecord)
    expect(screen.getByText('MyTestCode')).toBeInTheDocument()
  })
})

describe('Confirmation page — without record', () => {
  it('shows fallback message when no state', () => {
    render(
      <MemoryRouter initialEntries={['/confirmation']}>
        <AuthProvider>
          <Routes>
            <Route path="/confirmation" element={<Confirmation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByText(/no registration data/i)).toBeInTheDocument()
  })

  it('shows Go Home button when no record', () => {
    render(
      <MemoryRouter initialEntries={['/confirmation']}>
        <AuthProvider>
          <Routes>
            <Route path="/confirmation" element={<Confirmation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })
})
