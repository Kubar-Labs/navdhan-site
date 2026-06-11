import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  docLabel: string                   // e.g. "ITR" or "Form 26AS"
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
}

export default function SkipConfirmModal({
  open, docLabel, onCancel, onConfirm, busy = false,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/70 px-4">
      <div className="w-full max-w-md card space-y-4">
        <div className="flex items-center gap-2 text-amber-300 font-semibold">
          <AlertTriangle size={18} /> Skip {docLabel}?
        </div>
        <p className="text-sm text-graphite leading-relaxed">
          Without your {docLabel} data we won't be able to verify your income
          directly. We'll fall back to estimating from your GST filings —
          which is less accurate and may affect the loan offer you get.
        </p>
        <p className="text-sm text-graphite leading-relaxed">
          For the best result, please either upload your {docLabel} sheet or
          enter your IT portal credentials so we can fetch it on your behalf.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-xl border border-mist hover:border-steel text-ink py-2 text-sm font-medium transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            Go back
          </button>
          <button
            className="flex-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Skipping…' : 'Skip anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
