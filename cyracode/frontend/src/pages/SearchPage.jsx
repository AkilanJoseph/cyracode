import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search, MapPin, Navigation, Share2, X, Clock, ArrowLeft,
  Mail, Copy, MessageCircle, Facebook, WifiOff, Route,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MapPicker from '../components/MapPicker'
import Button from '../components/common/Button'
import { search } from '../services/api'

const HISTORY_KEY = 'cyracode_search_history'
const CACHE_PREFIX = 'cyracode_result_'

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// AC edge case: km vs miles based on locale
function formatDistance(km) {
  const useMiles = /^en-US|^en-LR|^en-MM/.test(navigator.language || '')
  if (useMiles) {
    const mi = km * 0.621371
    return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}

function loadCachedResult(name) {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + name.toLowerCase()) || 'null') }
  catch { return null }
}

function cacheResult(name, data) {
  try { localStorage.setItem(CACHE_PREFIX + name.toLowerCase(), JSON.stringify(data)) }
  catch {}
}

export default function SearchPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isFocused, setIsFocused] = useState(false)
  const [result, setResult] = useState(null)
  const [fuzzy, setFuzzy] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [userPos, setUserPos] = useState(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const debounceRef = useRef(null)
  const resultCardRef = useRef(null)

  // AC 5.5 / geolocation permission: silently get user position
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

  // Edge case: offline detection
  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // AC 5.5: Autocomplete with real-time filtering (300ms debounce)
  useEffect(() => {
    if (!query || query.length < 1) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await search.autocomplete(query)
        setSuggestions(data)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const saveHistory = (name) => {
    const next = [name, ...history.filter((h) => h !== name)].slice(0, 10)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  const doSearch = async (name) => {
    if (!name) return
    setLoading(true)
    setResult(null)
    setFuzzy([])
    setIsFocused(false)
    setShowShareSheet(false)

    // Edge case: offline mode — serve from cache
    if (!navigator.onLine) {
      const cached = loadCachedResult(name)
      if (cached) {
        setResult(cached)
        saveHistory(name)
        toast(t('search.offline_cache'), { icon: '📵' })
      } else {
        toast.error(t('search.offline_no_cache'))
      }
      setLoading(false)
      return
    }

    try {
      const { data } = await search.searchByName(name)
      setResult(data)
      cacheResult(name, data)
      saveHistory(name)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail && typeof detail === 'object') {
        setFuzzy(detail.suggestions || [])
        toast.error(detail.message || t('search.not_found'))
      } else {
        toast.error(detail || t('search.not_found'))
      }
    } finally {
      setLoading(false)
    }
  }

  // AC 5.6: Get Directions — opens the OpenStreetMap routing planner with the
  // user's current position as origin and the result as destination (when no
  // position is known, only the destination is pre-filled).
  const getDirections = useCallback(() => {
    if (!result) return
    const lat = Number(result.latitude)
    const lng = Number(result.longitude)
    const base = 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car'
    const mapHash = `#map=15/${lat}/${lng}`
    const url = userPos
      ? `${base}&route=${userPos.lat},${userPos.lng};${lat},${lng}${mapHash}`
      : `${base}&to=${lat},${lng}${mapHash}`
    window.open(url, '_blank')
  }, [result, userPos])

  // AC 5.7: Start Navigation — launches turn-by-turn navigation in the
  // platform's native navigation app (Apple Maps on iOS, Google Maps elsewhere),
  // falling back to a route in the browser when no navigation app is installed.
  const startNavigation = useCallback(() => {
    if (!result) return
    const dest = `${result.latitude},${result.longitude}`
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isIOS) {
      // Apple Maps is the system navigation app on iOS; daddr + dirflg=d starts turn-by-turn.
      window.open(`https://maps.apple.com/?daddr=${dest}&dirflg=d`, '_blank')
    } else {
      // Google Maps universal URL: dir_action=navigate starts turn-by-turn when the
      // origin defaults to the user's current location, otherwise shows a route preview.
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving&dir_action=navigate`,
        '_blank'
      )
    }
  }, [result])

  const shareLink = result
    ? `${window.location.origin}/search?q=${encodeURIComponent(result.name)}`
    : ''

  // AC 5.8: Pre-filled message format "Meet me at [Name]: [Full Address]"
  const shareText = result
    ? `${t('search.share_text', { name: result.name, address: result.full_address })}\n${shareLink}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    toast.success(t('search.link_copied'))
    setShowShareSheet(false)
  }
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  const shareEmail = () => {
    const subject = t('search.email_subject', { code: result?.name })
    const body = `${shareText}\n${result?.full_address || ''}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  const shareFacebook = () =>
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`, '_blank')

  const distance = result && userPos
    ? haversineKm(userPos.lat, userPos.lng, Number(result.latitude), Number(result.longitude))
    : null

  // AC 5.10: Show history or autocomplete in dropdown
  const isHistoryMode = query.length === 0
  const dropdownVisible = isFocused && (
    (query.length > 0 && suggestions.length > 0) ||
    (query.length === 0 && history.length > 0)
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Offline banner */}
      {isOffline && (
        <div className="top-0 left-0 right-0 z-20 bg-yellow-400/90 text-yellow-900 text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" /> Offline — showing cached results
        </div>
      )}

      <div className="relative max-w-md mx-auto px-4 pt-4">
        {/* Search bar */}
        <div className="bg-white rounded-2xl shadow-card-hover border border-border p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder={t('search.placeholder')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-xl outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-ink placeholder-muted"
              />

              {/* AC 5.10 + AC 5.5: Combined dropdown — history when empty, autocomplete when typing */}
              {dropdownVisible && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-card-hover z-20 overflow-hidden">
                  {isHistoryMode ? (
                    <>
                      <div className="px-3 py-2 flex items-center justify-between border-b border-border/50">
                        <span className="text-xs font-semibold text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('search.recent')}
                        </span>
                        <button
                          onClick={clearHistory}
                          className="text-xs text-muted hover:text-red-500 flex items-center gap-1 transition-colors"
                        >
                          <X className="w-3 h-3" /> {t('search.clear')}
                        </button>
                      </div>
                      {history.map((h) => (
                        <button
                          key={h}
                          onMouseDown={() => { setQuery(h); doSearch(h) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-light transition-colors border-b border-border/50 last:border-0 flex items-center gap-2"
                        >
                          <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span className="text-sm font-medium text-ink">{h}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    suggestions.map((s) => {
                      // AC 5.5: Show distance using lat/lng from autocomplete response
                      const dist = userPos && s.latitude != null && s.longitude != null
                        ? haversineKm(userPos.lat, userPos.lng, Number(s.latitude), Number(s.longitude))
                        : null
                      return (
                        <button
                          key={s.name}
                          onMouseDown={() => { setQuery(s.name); doSearch(s.name) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-light transition-colors border-b border-border/50 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-ink">{s.name}</p>
                            {dist !== null && (
                              <span className="text-xs text-muted shrink-0">{formatDistance(dist)}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted truncate">{s.address}</p>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <Button onMouseDown={() => doSearch(query)} loading={loading} size="sm" className="shrink-0 px-4">
              {t('search.go')}
            </Button>
          </div>
        </div>

        {/* AC 5.3 / 5.9: Result card after search */}
        {result && (
          <div
            ref={resultCardRef}
            className="bg-white rounded-2xl shadow-card-hover border border-border p-5 mt-3 animate-fade-in-up"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{t('search.cyracode_label')}</p>
                <h2 className="text-xl font-bold text-ink font-mono mt-0.5">{result.name}</h2>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                <MapPin className="w-3 h-3" /> {t('search.found')}
              </span>
            </div>

            <p className="text-sm text-muted mt-3 leading-relaxed">{result.full_address}</p>
            <p className="text-xs text-muted/70 font-mono mt-1">
              {Number(result.latitude).toFixed(6)}, {Number(result.longitude).toFixed(6)}
            </p>
            {distance !== null && (
              <p className="text-xs font-medium text-primary mt-1">
                {t('search.distance', { dist: formatDistance(distance) })}
              </p>
            )}

            {/* AC 5.6: Get Directions; AC 5.7: Start Navigation; AC 5.8: Share */}
            <div className="flex gap-2 mt-4">
              <Button onClick={getDirections} variant="secondary" className="flex-1" size="sm">
                <Route className="w-3.5 h-3.5" /> {t('search.get_directions')}
              </Button>
              <Button onClick={startNavigation} className="flex-1" size="sm">
                <Navigation className="w-3.5 h-3.5" /> {t('search.navigate')}
              </Button>
              <Button
                onClick={() => setShowShareSheet((v) => !v)}
                variant="secondary"
                size="sm"
                className="shrink-0 px-3"
              >
                <Share2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* AC 5.8: Share sheet — Email, WhatsApp, Facebook, Copy Link */}
            {showShareSheet && (
              <div className="mt-3 grid grid-cols-4 gap-2 animate-fade-in-up">
                {[
                  { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500', action: shareWhatsApp },
                  { label: t('search.email'), icon: Mail, color: 'text-blue-500', action: shareEmail },
                  { label: 'Facebook', icon: Facebook, color: 'text-blue-600', action: shareFacebook },
                  { label: t('search.copy'), icon: Copy, color: 'text-muted', action: copyLink },
                ].map(({ label, icon: Icon, color, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary-light transition-all"
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs font-medium text-muted text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Small map window — shown underneath the search after a result is selected */}
        {result && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-border shadow-card-hover animate-fade-in-up">
            <MapPicker
              readonly
              height="280px"
              markerPosition={{ lat: Number(result.latitude), lng: Number(result.longitude) }}
              searchResult={result}
              userPos={userPos}
              onGetDirections={getDirections}
            />
          </div>
        )}

        {/* AC 5.4: "Did you mean?" suggestions for fuzzy matches */}
        {fuzzy.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card border border-border p-4 mt-3 animate-fade-in-up">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">{t('search.did_you_mean')}</p>
            <div className="flex flex-wrap gap-2">
              {fuzzy.map((f) => (
                <button
                  key={f.name}
                  onClick={() => { setQuery(f.name); doSearch(f.name) }}
                  className="text-sm px-3 py-1.5 rounded-full bg-primary-light text-primary hover:bg-orange-100 transition-colors font-medium"
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
