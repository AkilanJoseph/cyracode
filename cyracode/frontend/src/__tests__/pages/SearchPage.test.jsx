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

  it('does not render map before a search', () => {
    setup()
    expect(screen.queryByTestId('map-picker')).not.toBeInTheDocument()
  })

  it('renders map picker after a search result', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestHome{Enter}')
    await screen.findByText(/Get Directions/i)
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

describe('SearchPage — directions vs navigation', () => {
  let openSpy

  beforeEach(() => {
    openSpy = vi.fn()
    window.open = openSpy
  })

  async function searchAndGetButtons(user) {
    await user.type(screen.getByPlaceholderText(/search a cyracode/i), 'TestHome{Enter}')
    await screen.findByText(/MG Road/i)
    return {
      directions: screen.getByRole('button', { name: /get directions/i }),
      navigate: screen.getByRole('button', { name: /start navigation/i }),
    }
  }

  it('Get Directions opens the OSM routing planner, not just the map', async () => {
    const { user } = setup()
    const { directions } = await searchAndGetButtons(user)
    await user.click(directions)
    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0][0]
    expect(url).toMatch(/^https:\/\/www\.openstreetmap\.org\/directions\?engine=fossgis_osrm_car/)
    expect(url).toContain('to=12.9716,77.5946')
  })

  it('Start Navigation opens a navigation deep link, not the map page', async () => {
    const { user } = setup()
    const { navigate } = await searchAndGetButtons(user)
    await user.click(navigate)
    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0][0]
    expect(url).toContain('dir_action=navigate')
    expect(url).toMatch(/destination=12\.9716,77\.5946/)
  })

  it('directions and navigation produce different URLs', async () => {
    const { user } = setup()
    const { directions, navigate } = await searchAndGetButtons(user)
    await user.click(directions)
    const directionsUrl = openSpy.mock.calls[0][0]
    await user.click(navigate)
    const navigateUrl = openSpy.mock.calls[1][0]
    expect(directionsUrl).not.toEqual(navigateUrl)
    expect(directionsUrl).not.toContain('dir_action=navigate')
    expect(navigateUrl).not.toContain('/directions?engine=')
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
