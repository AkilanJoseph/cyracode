import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Button from './Button'

/**
 * Blocking "are you sure?" used for actions that throw away work the user has
 * already invested in. The confirm button is styled as destructive, since
 * agreeing is the one path that cannot be undone from here.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  testId = 'confirm-dialog',
}) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-body`}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-modal animate-slide-in"
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div>
            <h2 id={`${testId}-title`} className="text-xl font-bold text-ink">
              {title}
            </h2>
            <p id={`${testId}-body`} className="text-sm text-muted mt-1">
              {body}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
