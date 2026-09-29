import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Returns to whatever screen the user actually came from, rather than a
 * hard-coded page. Falls back to `fallbackPath` on a cold load or direct link,
 * where there is no previous entry to go back to.
 *
 * Shared so a page-level Cancel and the header back button always agree.
 */
export function useGoBack(fallbackPath = '/dashboard') {
  const navigate = useNavigate()
  const location = useLocation()

  return () => {
    // location.key === 'default' means this is the first entry in history.
    const canGoBack = window.history.length > 1 && location.key !== 'default'
    if (canGoBack) navigate(-1)
    else navigate(fallbackPath)
  }
}
