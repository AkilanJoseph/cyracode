import { useEffect, useState } from 'react'
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
import { Navigation, LocateFixed } from 'lucide-react'

const defaultCenter = { lat: 20.5937, lng: 78.9629 }

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

// Recenter/rezoom the map when the marker position changes
function Recenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true })
  }, [center, zoom, map])
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
  useMapEvents({
    click(e) {
      if (readonly) return
      onLocationSelect(e.latlng.lat, e.latlng.lng)
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

  // AC 5.1: Center map on user's current location; default zoom 15
  useEffect(() => {
    if ((markerPosition || userPos || !navigator.geolocation)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    setMarker(markerPosition)
  }, [markerPosition])

  useEffect(() => {
    setUserLocation(userPos)
  }, [userPos])

  const handleLocation = (lat, lng) => {
    const pt = { lat, lng }
    setMarker(pt)
    setGeoCenter(pt)
    reverseGeocode(lat, lng).then((raw) => {
      const address = raw?.display_name || ''
      onLocationSelect && onLocationSelect(lat, lng, address, raw)
    })
  }

  const handleLocate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGeoCenter(pt)
        setUserLocation(pt)
        setLocating(false)
        if (!readonly) {
          handleLocation(pt.lat, pt.lng)
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const active = markerPosition || marker
  const mapCenter = active || geoCenter || userLocation || defaultCenter
  // AC 5.1: zoom 16 with a marker selected, 15 for user location, 5 for the world default
  const mapZoom = active ? 16 : geoCenter || userLocation ? 15 : 5

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
          <Recenter center={markerPosition || geoCenter || userLocation} zoom={mapZoom} />
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

        {/* Locate button */}
        <button
          onClick={handleLocate}
          title="Use my location"
          disabled={locating}
          className="absolute bottom-8 right-3 z-[500] flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border shadow-md hover:bg-surface transition-colors disabled:opacity-50"
        >
          <LocateFixed className={`w-4 h-4 text-primary ${locating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!readonly && active && (
        <p className="mt-2 text-sm text-gray-600">
          Selected: {Number(active.lat).toFixed(6)}, {Number(active.lng).toFixed(6)}
        </p>
      )}
    </div>
  )
}
