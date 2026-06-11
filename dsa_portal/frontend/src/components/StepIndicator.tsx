import { CheckCircle, Lock } from 'lucide-react'
import { BorrowerType, StepConfig, StepId, VerificationState } from '../types'

const ALL_STEPS: StepConfig[] = [
  { id: 'welcome',      label: 'Start',        description: 'Begin KYC' },
  { id: 'aadhaar',      label: 'Aadhaar',      description: 'Identity verification' },
  { id: 'pan',          label: 'Personal PAN', description: 'Signatory PAN & link check' },
  { id: 'business_pan', label: 'Business PAN', description: 'Entity PAN, CIN, GST' },
  { id: 'gst',          label: 'GST',          description: 'GST & returns' },
  { id: 'bank',         label: 'Bank',         description: 'Statement analysis' },
  { id: 'pl',           label: 'P&L',          description: 'Profit & Loss statement' },
  { id: 'itr',          label: 'ITR',          description: 'IT portal credentials' },
  { id: 'form26as',     label: '26AS',         description: 'TDS certificate' },
  { id: 'summary',      label: 'Summary',      description: 'Review results' },
]

// Steps that exist in UI but are not reachable in the journey.
// Keep here (don't remove) so we can flip them back on quickly.
const DISABLED_STEPS: ReadonlySet<StepId> = new Set<StepId>([])

interface Props {
  current: StepId
  state: VerificationState
  borrowerType: BorrowerType | null
}

export default function StepIndicator({ current, state, borrowerType }: Props) {
  const steps = borrowerType === 'individual'
    ? ALL_STEPS.filter(s => s.id !== 'business_pan')
    : ALL_STEPS
  const currentIdx = steps.findIndex(s => s.id === current)

  const isDone = (id: StepId) => {
    const stateMap: Record<string, 'success' | 'error' | 'skipped' | undefined> = {
      aadhaar:      state.aadhaar.status === 'success' ? 'success' : undefined,
      pan:          state.pan.status === 'success' ? 'success' : undefined,
      business_pan: state.businessPan.status === 'success' ? 'success' : undefined,
      gst:          state.gst.status === 'success' ? 'success' : undefined,
      bank:         state.bank.status === 'success' ? 'success' : undefined,
      pl:           state.pl.status === 'success' ? 'success' : undefined,
      itr:          state.itr.status === 'success' ? 'success' : undefined,
      form26as:     state.form26as.status === 'success' ? 'success' : undefined,
    }
    return stateMap[id] === 'success'
  }

  return (
    <nav className="w-56 flex-shrink-0">
      <div className="sticky top-8 space-y-1">
        {steps.map((step, idx) => {
          const isActive   = step.id === current
          const isPast     = idx < currentIdx
          const done       = isDone(step.id)
          const isDisabled = DISABLED_STEPS.has(step.id)

          return (
            <div key={step.id}
              className={`flex items-start gap-3 py-2 px-3 rounded-xl transition-all duration-200 ${
                isDisabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              style={{ background: isActive ? 'rgba(246,147,30,0.10)' : 'transparent' }}>
              <div className={`step-badge mt-0.5 transition-all duration-300 ${
                isDisabled ? 'bg-paper text-steel border border-mist' :
                done       ? 'bg-green-500/15 text-green-600' :
                isActive   ? 'bg-ember text-white' :
                isPast     ? 'bg-fog text-graphite' :
                             'bg-fog text-steel'
              }`}>
                {isDisabled ? <Lock size={12} /> : done ? <CheckCircle size={14} /> : idx + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate transition-colors ${
                  isDisabled ? 'text-steel line-through' :
                  isActive   ? 'text-ink' :
                  isPast || done ? 'text-graphite' : 'text-steel'
                }`}>{step.label}</p>
                <p className="text-xs text-steel truncate">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
