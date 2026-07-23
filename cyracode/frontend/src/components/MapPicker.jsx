import { useCallback, useEffect, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { MapPin, Navigation } from 'lucide-react'

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
  ''

const containerStyle = { width: '100%', height: '100%' }
const defaultCenter = { lat: 20.5937, lng: 78.9629 }

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

// Green SVG pin for CyraCode markers (AC 5.3)
const GREEN_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="43" viewBox="0 0 27 43">
    <path fill="#22c55e" stroke="#15803d" stroke-width="1.5" d="M13.5 0C6.044 0 0 6.044 0 13.5c0 10.125 13.5 29.5 13.5 29.5S27 23.625 27 13.5C27 6.044 20.956 0 13.5 0z"/>
    <circle fill="white" cx="13.5" cy="13.5" r="6"/>
  </svg>`
)

export default function MapPicker({
  onLocationSelect,
  readonly = false,
  markerPosition = null,
  height = '360px',
  searchResult = null,
  userPos = null,
  onGetDirections = null,
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const [marker, setMarker] = useState(markerPosition)
  const [geoCenter, setGeoCenter] = useState(null)
  const [showInfoWindow, setShowInfoWindow] = useState(false)

  // AC 5.1: Center map on user's current location; default zoom 15
  useEffect(() => {
    if (markerPosition || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    setMarker(markerPosition)
    if (markerPosition) setShowInfoWindow(false)
  }, [markerPosition])

  const reverseGeocode = useCallback((lat, lng, cb) => {
    if (!window.google || !window.google.maps) { cb(''); return }
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) cb(results[0].formatted_address, results[0])
      else cb('')
    })
  }, [])

  const handleClick = useCallback(
    (e) => {
      if (readonly) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarker({ lat, lng })
      reverseGeocode(lat, lng, (address, raw) => {
        onLocationSelect && onLocationSelect(lat, lng, address, raw)
      })
    },
    [readonly, onLocationSelect, reverseGeocode]
  )

  const active = markerPosition || marker
  const mapCenter = active || geoCenter || defaultCenter

  // AC 5.1: zoom 15 when user location available, 5 for world default
  const mapZoom = active ? 16 : geoCenter ? 15 : 5

  const greenIcon = isLoaded
    ? {
        url: `data:image/svg+xml;charset=UTF-8,${GREEN_PIN_SVG}`,
        scaledSize: new window.google.maps.Size(27, 43),
        anchor: new window.google.maps.Point(13.5, 43),
      }
    : undefined

  const infoDistance =
    userPos && active
      ? formatDist(haversineKm(userPos.lat, userPos.lng, active.lat, active.lng))
      : null

  if (!GOOGLE_MAPS_API_KEY) {
    const [demoLat, setDemoLat] = useState(String(defaultCenter.lat))
    const [demoLng, setDemoLng] = useState(String(defaultCenter.lng))
    const applyCoords = () => {
      const lat = parseFloat(demoLat)
      const lng = parseFloat(demoLng)
      if (isNaN(lat) || isNaN(lng)) return
      setMarker({ lat, lng })
      onLocationSelect && onLocationSelect(lat, lng, 'Manual location (no API key)')
    }
    return (
      <div className="w-full">
        <div
          className="w-full flex flex-col items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 gap-3 py-6 px-4"
          style={{ height }}
        >
          <MapPin className="w-8 h-8 text-gray-400" />
          <p className="text-sm font-medium">Google Maps API key not configured</p>
          {!readonly && (
            <div className="w-full max-w-xs space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={demoLat}
                    onChange={(e) => setDemoLat(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={demoLng}
                    onChange={(e) => setDemoLng(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md outline-none focus:border-primary"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={applyCoords}
                className="w-full py-1.5 text-xs font-semibold text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
              >
                Use these coordinates
              </button>
            </div>
          )}
        </div>
        {active && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {Number(active.lat).toFixed(6)}, {Number(active.lng).toFixed(6)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onClick={handleClick}
            options={{ streetViewControl: false, mapTypeControl: false }}
          >
            {active && (
              <Marker
                position={active}
                icon={readonly ? greenIcon : undefined}
                onClick={() => readonly && setShowInfoWindow(true)}
              />
            )}

            {/* AC 5.9: InfoWindow popup on marker click */}
            {readonly && active && showInfoWindow && (
              <InfoWindow
                position={active}
                onCloseClick={() => setShowInfoWindow(false)}
              >
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
                      onClick={() => { setShowInfoWindow(false); onGetDirections() }}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md px-3 py-1.5 transition-colors"
                    >
                      <Navigation className="w-3 h-3" /> Directions
                    </button>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            Loading map…
          </div>
        )}
      </div>
      {!readonly && active && (
        <p className="mt-2 text-sm text-gray-600">
          Selected: {Number(active.lat).toFixed(6)}, {Number(active.lng).toFixed(6)}
        </p>
      )}
    </div>
  )
}
