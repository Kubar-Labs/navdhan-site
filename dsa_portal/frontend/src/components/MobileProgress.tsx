import { CheckCircle, Lock } from 'lucide-react'
import { BorrowerType, StepId, VerificationState } from '../types'

const ALL_STEPS: { id: StepId; label: string }[] = [
  { id: 'aadhaar',      label: 'Aadhaar' },
  { id: 'pan',          label: 'Personal PAN' },
  { id: 'business_pan', label: 'Biz PAN' },
  { id: 'gst',          label: 'GST' },
  { id: 'bank',         label: 'Bank' },
  { id: 'pl',           label: 'P&L' },
  { id: 'itr',          label: 'ITR' },
  { id: 'form26as',     label: '26AS' },
  { id: 'summary',      label: 'Done' },
]

// Steps temporarily disabled (kept in UI but unreachable). Sync with App.tsx STEP_ORDER.
const DISABLED_STEPS: ReadonlySet<StepId> = new Set<StepId>([])

interface Props {
  current: StepId
  state: VerificationState
  borrowerType: BorrowerType | null
}

export default function MobileProgress({ current, state, borrowerType }: Props) {
  const steps = borrowerType === 'individual'
    ? ALL_STEPS.filter(s => s.id !== 'business_pan')
    : ALL_STEPS
  const currentIdx = steps.findIndex(s => s.id === current)

  const isDone = (id: StepId) => {
    const map: Partial<Record<StepId, boolean>> = {
      aadhaar:      state.aadhaar.status === 'success',
      pan:          state.pan.status === 'success',
      business_pan: state.businessPan.status === 'success',
      gst:          state.gst.status === 'success',
      bank:         state.bank.status === 'success',
      pl:           state.pl.status === 'success',
      itr:          state.itr.status === 'success',
      form26as:     state.form26as.status === 'success',
    }
    return !!map[id]
  }

  return (
    <div className="flex items-center px-4 py-3 border-b border-mist overflow-x-auto no-scrollbar">
      {steps.map((s, idx) => {
        const isActive   = s.id === current
        const done       = isDone(s.id)
        const isPast     = idx < currentIdx
        const isDisabled = DISABLED_STEPS.has(s.id)

        return (
          <div key={s.id} className={`flex items-center flex-shrink-0 ${isDisabled ? 'opacity-40' : ''}`}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDisabled ? 'bg-paper border border-mist text-steel' :
                done       ? 'bg-green-500/15 text-green-600' :
                isActive   ? 'bg-ember text-white' :
                isPast     ? 'bg-fog text-graphite' :
                             'bg-fog text-steel'
              }`}>
                {isDisabled ? <Lock size={11} /> : done ? <CheckCircle size={13} /> : idx + 1}
              </div>
              <span className={`text-[10px] font-medium ${
                isDisabled ? 'text-steel line-through' :
                isActive   ? 'text-ember' :
                isPast || done ? 'text-steel' : 'text-mist'
              }`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-px w-6 mx-1 mb-4 transition-all ${
                isPast || done ? 'bg-ember/50' : 'bg-fog'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
