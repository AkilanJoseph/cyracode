import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { AuthProvider } from '../../context/AuthContext'
import SearchPage from '../../pages/SearchPage'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// MapPicker uses Google Maps — skip its rendering in unit tests
vi.mock('../../components/MapPicker', () => ({
  default: ({ markerPosition }) => (
    <div data-testid="map-picker">
      {markerPosition && <span>Marker at {markerPosition.lat}</span>}
    </div>
  ),
}))

function setup() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <AuthProvider>
          <SearchPage />
        </AuthProvider>
      </MemoryRouter>
    ),
  }
}

describe('SearchPage — rendering', () => {
  it('renders search input', () => {
    setup()
    expect(screen.getByPlaceholderText(/search a cyracode/i)).toBeInTheDocument()
  })

  it('renders Go button', () => {
    setup()
    expect(screen.getByRole('button', { name: /go/i })).toBeInTheDocument()
  })

  it('renders map picker', () => {
    setup()
    expect(screen.getByTestId('map-picker')).toBeInTheDocument()
  })
})

describe('SearchPage — autocomplete', () => {
  it('shows autocomplete suggestions while typing', async () => {
    const { user } = setup()
    const input = screen.getByPlaceholderText(/search a cyracode/i)
    await user.type(input, 'Test')
    await waitFor(() =>
      expect(screen.getByText('TestHome')).toBeInTheDocument()
    )
  })

  it('hides suggestions for empty query', async () => {
    const { user } = setup()
    const input = screen.getByPlaceholderText(/search a cyracode/i)
    await user.type(input, 'T')
    await waitFor(() => screen.getByText('TestHome'))
    await user.clear(input)
    await waitFor(() =>
      expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
    )
  })
})

describe('SearchPage — search results', () => {
  it('shows result after clicking Go', async () => {
    const { user } = setup()
    const input = screen.getByPlaceholderText(/search a cyracode/i)
    await user.type(input, 'TestHome')
    await user.click(screen.getByRole('button', { name: /go/i }))
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    expect(await screen.findByText(/Get Directions/i)).toBeInTheDocument()
  })

  it('shows result after pressing Enter', async () => {
    const { user } = setup()
    const input = screen.getByPlaceholderText(/search a cyracode/i)
    await user.type(input, 'TestHome{Enter}')
    expect(await screen.findByText(/Get Directions/i)).toBeInTheDocument()
  })

  it('shows full address in result', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestHome{Enter}')
    expect(await screen.findByText(/MG Road/i)).toBeInTheDocument()
  })

  it('shows coordinates in result', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestHome{Enter}')
    const matches = await screen.findAllByText(/12\.97/)
    expect(matches.length).toBeGreaterThan(0)
  })
})

describe('SearchPage — not found / fuzzy', () => {
  it('shows fuzzy suggestions when not found', async () => {
    server.use(
      http.get('http://localhost:5173/api/search/:name', () =>
        HttpResponse.json(
          { detail: { message: "No CyraCode found for 'TestMiss'.", suggestions: [{ name: 'TestHome', address: 'MG Road' }] } },
          { status: 404 }
        )
      )
    )
    const { user } = setup()
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestMiss{Enter}')
    expect(await screen.findByText(/did you mean/i)).toBeInTheDocument()
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
  })
})

describe('SearchPage — history', () => {
  it('saves and shows search history', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestHome{Enter}')
    await screen.findByText(/Get Directions/i)
    // Re-render to check history
    setup()
    const matches = screen.getAllByText('TestHome')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('clear history removes all entries', async () => {
    localStorage.setItem('cyracode_search_history', JSON.stringify(['TestHome']))
    const { user } = setup()
    await user.click(screen.getByPlaceholderText(/search a cyracode/i))
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    await user.click(screen.getByText(/clear/i))
    expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
  })
})
