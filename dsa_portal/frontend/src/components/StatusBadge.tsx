import { CheckCircle, XCircle, Clock, SkipForward } from 'lucide-react'
import { StepResult } from '../types'

export default function StatusBadge({ result }: { result: StepResult }) {
  if (result.status === 'idle') return null
  const map = {
    loading: { icon: <Clock size={14} className="animate-spin" />, cls: 'text-yellow-600 bg-yellow-400/10', label: 'Processing' },
    success: { icon: <CheckCircle size={14} />, cls: 'text-green-600 bg-green-400/10', label: 'Verified' },
    error:   { icon: <XCircle size={14} />,    cls: 'text-red-600 bg-red-400/10',     label: 'Failed' },
    skipped: { icon: <SkipForward size={14} />, cls: 'text-graphite bg-fog', label: 'Skipped' },
    idle:    { icon: null, cls: '', label: '' },
  }
  const { icon, cls, label } = map[result.status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
      {icon} {label}
    </span>
  )
}
