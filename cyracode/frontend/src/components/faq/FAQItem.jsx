import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// One question/answer pair. State lives here rather than in the page so a
// category can keep several answers open at once without the page coordinating
// them, and so each row stays a self-contained disclosure.
//
// The panel is unmounted while closed rather than hidden with CSS. The answer
// then never reaches a screen reader on load or when collapsed, and "is the
// answer in the DOM?" is a reliable thing for tests to assert on.
export default function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  const baseId = useId()
  const buttonId = `${baseId}-question`
  const panelId = `${baseId}-answer`

  return (
    <div className="rounded-xl border border-border bg-white shadow-card overflow-hidden">
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 sm:px-5 sm:py-4
            text-left text-sm sm:text-base font-semibold text-ink transition-colors
            hover:bg-primary-light/40 focus:outline-none focus-visible:ring-2
            focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="min-w-0">{question}</span>
          {/* Decorative: the collapsed/expanded state is already announced by
              aria-expanded on the button, so the icon is hidden from AT. */}
          <ChevronDown
            className={`w-5 h-5 shrink-0 text-primary transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="px-4 pb-4 sm:px-5 sm:pb-5 -mt-1 animate-fade-in-up"
        >
          <p className="text-sm text-muted leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
