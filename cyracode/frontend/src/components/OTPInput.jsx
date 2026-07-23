import { useRef, useState, useEffect } from 'react'

export default function OTPInput({ length = 6, onChange, value = '', label = 'One-time password' }) {
  const [digits, setDigits] = useState(
    () => value.padEnd(length, '').slice(0, length).split('')
  )
  const inputs = useRef([])

  useEffect(() => {
    onChange && onChange(digits.join(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  const setDigit = (idx, val) => {
    const next = [...digits]
    next[idx] = val
    setDigits(next)
  }

  const handleChange = (idx, e) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      setDigit(idx, '')
      return
    }
    const char = raw[raw.length - 1]
    setDigit(idx, char)
    if (idx < length - 1) {
      inputs.current[idx + 1]?.focus()
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        setDigit(idx, '')
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus()
        setDigit(idx - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      inputs.current[idx + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = pasted.padEnd(length, '').slice(0, length).split('')
    setDigits(next)
    const focusIdx = Math.min(pasted.length, length - 1)
    inputs.current[focusIdx]?.focus()
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          aria-label={`Digit ${idx + 1} of ${length}`}
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg
            outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        />
      ))}
    </div>
  )
}
