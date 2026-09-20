import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ fallbackPath = '/dashboard' }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = () => {
    // location.key === 'default' means this is the first entry in history.
    // In that case there is no previous page to return to, so go to the fallback.
    const canGoBack = window.history.length > 1 && location.key !== 'default'
    if (canGoBack) navigate(-1)
    else navigate(fallbackPath)
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Back"
      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors shrink-0"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  )
}