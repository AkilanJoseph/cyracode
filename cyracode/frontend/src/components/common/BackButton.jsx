import { ArrowLeft } from 'lucide-react'
import { useGoBack } from '../../utils/navigation'

export default function BackButton({ fallbackPath = '/dashboard' }) {
  const goBack = useGoBack(fallbackPath)

  return (
    <button
      onClick={goBack}
      aria-label="Back"
      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors shrink-0"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  )
}
