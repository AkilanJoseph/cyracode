import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MapPicker from '../../components/MapPicker'

const h = vi.hoisted(() => {
  const getCurrentPosition = vi.fn()
  const clickHandlerRef = { current: null }
  const setView = vi.fn()
  return { getCurrentPosition, clickHandlerRef, setView }
})

vi.mock('react-leaflet', async () => {
  const { createElement } = await import('react')
  return {
    MapContainer: ({ children }) =>
      createElement('div', { 'data-testid': 'map' }, children),
    TileLayer: () => null,
    Marker: ({ position }) =>
      createElement('div', {
        'data-testid': 'marker',
        'data-lat': Number(position.lat),
        'data-lng': Number(position.lng),
      }),
    Popup: ({ children }) => createElement('div', { 'data-testid': 'popup' }, children),
    Circle: () => null,
    useMap: () => ({
      setView: h.setView,
      getZoom: () => 16,
      setZoomAround: vi.fn(),
      invalidateSize: vi.fn(),
    }),
    useMapEvents: (handlers) => {
      h.clickHandlerRef.current = handlers
      return null
    },
  }
})

vi.mock('leaflet', () => ({
  default: { divIcon: () => ({}), Icon: function Icon() {} },
}))

// jsdom has no geolocation; install a controllable mock per test.
function installGeolocation() {
  const implementation = {
    getCurrentPosition: h.getCurrentPosition,
  }
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: implementation,
  })
  return implementation
}

const FIX = {
  coords: { latitude: 12.9715987, longitude: 77.5945627, accuracy: 4 },
}

describe('MapPicker — exactly-adapted current location', () => {
  beforeEach(() => {
    h.getCurrentPosition.mockReset()
    h.setView.mockReset()
    h.clickHandlerRef.current = null
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests GPS-grade geolocation options (high accuracy, fresh fix, timeout)', async () => {
    installGeolocation()
    h.getCurrentPosition.mockImplementation((ok) => ok(FIX))

    render(<MapPicker onLocationSelect={() => {}} />)

    await waitFor(() => expect(h.getCurrentPosition).toHaveBeenCalled())
    const [, , options] = h.getCurrentPosition.mock.calls[0]
    expect(options).toEqual({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })

  it('Scenario A — centers, pins, and reports the exact returned coordinates', async () => {
    installGeolocation()
    h.getCurrentPosition.mockImplementation((ok) => ok(FIX))
    const onLocationSelect = vi.fn()

    render(<MapPicker onLocationSelect={onLocationSelect} />)

    await waitFor(() => expect(onLocationSelect).toHaveBeenCalled())
    const [lat, lng] = onLocationSelect.mock.calls[0]
    expect(lat).toBe(12.9715987)
    expect(lng).toBe(77.5945627)

    expect(await screen.findByText(/Selected: 12\.971599, 77\.594563/i)).toBeInTheDocument()
    expect(screen.getByText(/\(±4 m\)/)).toBeInTheDocument()
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(0)
  })

  it('Scenario B — permission denied shows a clear message and Retry re-detects', async () => {
    const user = userEvent.setup()
    installGeolocation()

    h.getCurrentPosition.mockImplementationOnce((ok, err) => err({ code: 1 }))
    const onLocationSelect = vi.fn()

    render(<MapPicker onLocationSelect={onLocationSelect} />)

    await waitFor(() =>
      expect(screen.getByText(/location access was denied/i)).toBeInTheDocument()
    )
    expect(onLocationSelect).not.toHaveBeenCalled()

    // User grants permission, then retries.
    h.getCurrentPosition.mockImplementation((ok) => ok(FIX))
    await user.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(onLocationSelect).toHaveBeenCalledWith(12.9715987, 77.5945627, '', null))
    expect(screen.queryByText(/location access was denied/i)).not.toBeInTheDocument()
  })

  it('Scenario C — location services off opens an enable-location dialog with Retry', async () => {
    installGeolocation()
    h.getCurrentPosition.mockImplementation((ok, err) => err({ code: 2 }))

    render(<MapPicker onLocationSelect={() => {}} />)

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /enable location/i })).toBeInTheDocument()
    )
    expect(screen.getByText(/turn on location services/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry location detection/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('reports a timeout distinctly', async () => {
    installGeolocation()
    h.getCurrentPosition.mockImplementation((ok, err) => err({ code: 3 }))

    render(<MapPicker onLocationSelect={() => {}} />)

    await waitFor(() =>
      expect(screen.getByText(/timed out while detecting your location/i)).toBeInTheDocument()
    )
  })

  it('informs the user when the browser has no geolocation support (inline, no dialog)', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    render(<MapPicker onLocationSelect={() => {}} />)

    expect(screen.getByText(/browser does not support geolocation/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Scenario D — a manual map click updates the coordinates and clears accuracy', async () => {
    installGeolocation()
    // No geolocation fix: the user picks manually.
    h.getCurrentPosition.mockImplementation((ok, err) => err(new Error('nope')))
    const onLocationSelect = vi.fn()

    render(<MapPicker onLocationSelect={onLocationSelect} />)

    await waitFor(() => expect(h.clickHandlerRef.current).toBeTruthy())

    h.clickHandlerRef.current.click({ latlng: { lat: 9.1234567, lng: 8.7654321 } })

    await waitFor(() =>
      expect(onLocationSelect).toHaveBeenCalledWith(9.1234567, 8.7654321, '', null)
    )
    expect(await screen.findByText(/Selected: 9\.123457, 8\.765432/i)).toBeInTheDocument()
    expect(screen.queryByText(/±/)).not.toBeInTheDocument()
  })
})