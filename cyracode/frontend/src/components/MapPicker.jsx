import { useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  Circle,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation, LocateFixed, Loader2, AlertTriangle, MapPin, X } from 'lucide-react'

const defaultCenter = { lat: 20.5937, lng: 78.9629 }

// Geolocation settings: request the highest available accuracy (GPS on
// devices that have it), never accept a stale cached fix, and allow a
// reasonable window for the browser to obtain a fresh, precise position.
const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
}

// Map every browser geolocation failure to a user-friendly message so the UI
// never degrades into a silent/approximate position.
function geoErrorMessage(code) {
  switch (code) {
    case 1:
      return 'Location access was denied. Allow location permission for this site, then press Locate to retry.'
    case 2:
      return 'Location is unavailable. Turn on location services for this device, then press Locate to retry.'
    case 3:
      return 'Timed out while detecting your location. Press Locate to try again.'
    default:
      return 'Could not detect your location. Press Locate to try again.'
  }
}

// OSM tile server (no API key required)
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Green SVG pin for CyraCode markers (AC 5.3)
const GREEN_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="43" viewBox="0 0 27 43">
    <path fill="#22c55e" stroke="#15803d" stroke-width="1.5" d="M13.5 0C6.044 0 0 6.044 0 13.5c0 10.125 13.5 29.5 13.5 29.5S27 23.625 27 13.5C27 6.044 20.956 0 13.5 0z"/>
    <circle fill="white" cx="13.5" cy="13.5" r="6"/>
  </svg>`
)

const greenIcon = L.divIcon({
  className: '',
  html: `<img src="data:image/svg+xml;charset=UTF-8,${GREEN_PIN_SVG}" alt="" style="width:27px;height:43px;pointer-events:none"/>`,
  iconSize: [27, 43],
  iconAnchor: [13.5, 43],
})

const redIcon = new L.Icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Bi-color icon for the user's current position
const userIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2563eb" stroke="#ffffff" stroke-width="2"/></svg>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km) {
  const useMiles = /^en-US|^en-LR|^en-MM/.test(navigator.language || '')
  if (useMiles) {
    const mi = km * 0.621371
    return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

const containerStyle = { width: '100%', height: '100%' }

// Recenter/rezoom the map when the marker position changes.
// `skip` is used when the marker change is an echo of a click that happened
// inside this map, so the view is left exactly where the user clicked.
function Recenter({ center, zoom, skip }) {
  const map = useMap()
  useEffect(() => {
    if (skip || !center) return
    map.setView(center, zoom, { animate: true })
  }, [center, zoom, map, skip])
  return null
}

// Fix Leaflet's blank/blue map: on mount the container may have no measured
// size yet, so no tiles load. Re-measure the map once it is rendered.
function InvalidateSizeOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// Re-measure the map whenever its container size changes (e.g. a sibling
// caption or layout shift) so tiles render correctly.
function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const container = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

// Click-to-select handler; only active when not readonly
function ClickHandler({ onLocationSelect, readonly }) {
  const map = useMap()
  useMapEvents({
    click(e) {
      if (readonly) return
      const { lat, lng } = e.latlng
      onLocationSelect(lat, lng, { fromClick: true })
      // Keep the clicked point anchored under the cursor while zooming in to
      // the selection zoom, so the pin lands exactly on the spot instead of
      // being re-centered (which makes it appear to jump).
      const targetZoom = Math.max(map.getZoom(), 16)
      if (targetZoom > map.getZoom()) {
        map.setZoomAround({ lat, lng }, targetZoom, { animate: true })
      }
    },
  })
  return null
}

// Reverse geocode a coordinate using OSM Nominatim (free, no key required).
// Returns the full JSON payload (or null on failure) so callers can use the
// raw address fields; the display name is `display_name`.
async function reverseGeocode(lat, lng) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en&zoom=18`
    )
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

export default function MapPicker({
  onLocationSelect,
  readonly = false,
  markerPosition = null,
  height = '360px',
  searchResult = null,
  userPos = null,
  onGetDirections = null,
}) {
  const [marker, setMarker] = useState(markerPosition)
  const [geoCenter, setGeoCenter] = useState(null)
  const [userLocation, setUserLocation] = useState(userPos)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)
  // Browser geolocation error code for the current failure (1 = permission
  // denied, 2 = location services off/unavailable, 3 = timeout, null = non
  // geolocation failure e.g. unsupported browser). Codes 1-3 open the
  // "enable location" modal with a Retry action; everything else stays a
  // plain inline notice since retrying cannot help.
  const [locationErrorCode, setLocationErrorCode] = useState(null)
  const [accuracyMeters, setAccuracyMeters] = useState(null)
  // Coordinates of the last point chosen by clicking inside this map; used to
  // detect the parent echoing the click back via `markerPosition`.
  const lastClickRef = useRef(null)

  // Default Map to Current Location: when the map opens with no pre-selected
  // marker (and it is not read-only), detect the current location using the
  // most accurate position the browser can provide, center on it, drop the
  // pin, and sync the parent's lat/lng fields. Any failure surfaces a clear
  // message + Retry instead of silently falling back to an approximate spot.
  useEffect(() => {
    if (readonly || markerPosition || userPos) return
    requestPosition()
  }, [])

  useEffect(() => {
    if (markerPosition) setMarker(markerPosition)
  }, [markerPosition])

  useEffect(() => {
    if (userPos) setUserLocation(userPos)
  }, [userPos])

  const handleLocation = (lat, lng, opts = {}) => {
    const pt = { lat, lng }
    setMarker(pt)
    if (opts.fromClick) {
      // The user placed the pin by clicking the map: keep the current view so
      // the pin lands exactly where they clicked instead of re-centering it.
      lastClickRef.current = pt
      // The pin is now a manual pick, so the geolocation accuracy no longer
      // applies and any "enable location" prompt can leave the way.
      setAccuracyMeters(null)
      setLocationError(null)
      setLocationErrorCode(null)
    } else {
      setGeoCenter(pt)
    }
    reverseGeocode(lat, lng).then((raw) => {
      const address = raw?.display_name || ''
      onLocationSelect && onLocationSelect(lat, lng, address, raw)
    })
  }

  // Single geolocation flow shared by the initial default-map behavior and the
  // Locate/Retry button. Uses GPS-grade accuracy settings and reports the
  // accuracy radius so the shown coordinates can be verified.
  const requestPosition = () => {
    if (!navigator.geolocation) {
      setLocationErrorCode(null)
      setLocationError('Your browser does not support geolocation. Select your location on the map instead.')
      return
    }
    setLocating(true)
    setLocationError(null)
    setLocationErrorCode(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setAccuracyMeters(
          pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null
        )
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGeoCenter(pt)
        setUserLocation(pt)
        if (!readonly) {
          handleLocation(pt.lat, pt.lng)
        }
      },
      (err) => {
        setLocating(false)
        setAccuracyMeters(null)
        setLocationErrorCode(err && err.code ? err.code : null)
        setLocationError(geoErrorMessage(err && err.code))
      },
      GEO_OPTIONS
    )
  }

  const active = markerPosition || marker
  const mapCenter = active || geoCenter || userLocation || defaultCenter
  // AC 5.1: zoom 16 with a marker selected, 15 for user location, 5 for the world default
  const mapZoom = active ? 16 : geoCenter || userLocation ? 15 : 5

  // A click inside this map flows back from the parent as a new markerPosition
  // prop. Detect that echo so Recenter does not yank the map back to the pin
  // (which makes the pin appear to jump to a different location).
  const recenterCenter = markerPosition || geoCenter || userLocation
  const isClickEcho =
    lastClickRef.current &&
    markerPosition &&
    Number(markerPosition.lat) === Number(lastClickRef.current.lat) &&
    Number(markerPosition.lng) === Number(lastClickRef.current.lng)

  const infoDistance =
    userLocation && active
      ? formatDist(
          haversineKm(
            userLocation.lat,
            userLocation.lng,
            Number(active.lat),
            Number(active.lng)
          )
        )
      : null

  const activeIcon = readonly ? greenIcon : redIcon

  return (
    <div className="w-full">
      <div className="relative w-full rounded-lg overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom
          style={containerStyle}
        >
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
          <Recenter center={recenterCenter} zoom={mapZoom} skip={isClickEcho} />
          <InvalidateSizeOnMount />
          <InvalidateOnResize />
          <ClickHandler onLocationSelect={handleLocation} readonly={readonly} />

          {/* User's current position */}
          {userLocation && (
            <>
              <Circle
                center={userLocation}
                radius={250}
                pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }}
              />
              <Marker position={userLocation} icon={userIcon} interactive={false} />
            </>
          )}

          {/* Selected / result marker */}
          {active && (
            <Marker position={active} icon={activeIcon}>
              {readonly && (
                <Popup>
                  <div className="min-w-[220px] max-w-[280px] font-sans">
                    {searchResult && (
                      <>
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                          CyraCode
                        </p>
                        <p className="text-base font-bold text-gray-900 font-mono mb-1">
                          {searchResult.name}
                        </p>
                        <p className="text-sm text-gray-600 leading-snug mb-1">
                          {searchResult.full_address}
                        </p>
                      </>
                    )}
                    <p className="text-xs text-gray-400 font-mono mb-1">
                      {Number(active.lat).toFixed(6)}, {Number(active.lng).toFixed(6)}
                    </p>
                    {infoDistance && (
                      <p className="text-xs text-blue-600 font-medium mb-2">
                        ~{infoDistance} away
                      </p>
                    )}
                    {onGetDirections && (
                      <button
                        onClick={() => onGetDirections()}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md px-3 py-1.5 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Directions
                      </button>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          )}
        </MapContainer>

        {/* Locate / retry button */}
        <button
          onClick={requestPosition}
          title="Use my location"
          disabled={locating}
          className="absolute bottom-8 right-3 z-[500] flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border shadow-md hover:bg-surface transition-colors disabled:opacity-50"
        >
          <LocateFixed className={`w-4 h-4 text-primary ${locating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {locating && (
        <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Detecting your current location…
        </p>
      )}

      {/* Enable-location modal — shown when the browser cannot get a fix
          (permission denied / location services off / timeout). Retrying is the
          only way forward, so the user gets a clear prompt instead of a silent
          fallback. Dismissing keeps the map usable for manual selection. */}
      {locationError && locationErrorCode != null && (
        <div
          className="absolute inset-0 z-[600] flex items-center justify-center bg-white/70 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enable location"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-border shadow-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-amber-600" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-ink leading-snug">
                  Enable location to show your current position
                </h3>
              </div>
              <button
                onClick={() => { setLocationError(null); setLocationErrorCode(null) }}
                aria-label="Close"
                className="text-muted hover:text-ink transition-colors shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted leading-snug">{locationError}</p>
            <p className="mt-1.5 text-xs text-muted">
              You can also select a location manually on the map.
            </p>
            <button
              onClick={requestPosition}
              disabled={locating}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-primary hover:bg-teal-600 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
              )}
              {locating ? 'Detecting…' : 'Retry location detection'}
            </button>
          </div>
        </div>
      )}

      {locationError && locationErrorCode == null && (
        <div className="mt-2 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">{locationError}</div>
        </div>
      )}

      {!readonly && active && (
        <p className="mt-2 text-sm text-gray-600">
          Selected: {Number(active.lat).toFixed(6)}, {Number(active.lng).toFixed(6)}
          {accuracyMeters != null && <> (±{accuracyMeters} m)</>}
        </p>
      )}
    </div>
  )
}
