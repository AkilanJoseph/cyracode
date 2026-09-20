import { Check } from 'lucide-react'

export default function ProgressSteps({ steps = [], current = 1 }) {
  return (
    <div className="flex items-center w-full mb-6">
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === current
        const isDone = stepNum < current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all
                  ${isDone
                    ? 'bg-primary text-white'
                    : isActive
                    ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-surface border-2 border-border text-muted'
                  }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : stepNum}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  isActive ? 'text-primary' : isDone ? 'text-muted' : 'text-muted/50'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mb-5 transition-colors ${
                  stepNum < current ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
