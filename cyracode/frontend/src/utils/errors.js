export function apiErrorMessage(err, fallback) {
  const data = err?.response?.data
  const detail = data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const first = detail.find((d) => typeof d?.msg === 'string' && d.msg)?.msg
    if (first) return first
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message) return detail.message
    if (typeof detail.error === 'string' && detail.error) return detail.error
  }
  if (typeof data?.error === 'string' && data.error) return data.error
  return fallback
}