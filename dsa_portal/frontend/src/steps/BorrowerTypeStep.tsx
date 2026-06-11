import { Building2, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import { BorrowerType } from '../types'

interface Props {
  value: BorrowerType | null
  onSelect: (t: BorrowerType) => void
  onNext: () => void
}

const OPTIONS: {
  key: BorrowerType
  title: string
  subtitle: string
  bullets: string[]
  icon: React.ReactNode
}[] = [
  {
    key:      'individual',
    title:    'Sole Proprietor / Individual',
    subtitle: 'You file your business income on your personal PAN.',
    bullets:  [
      'No separate business PAN',
      'ITR & Form 26AS use your personal PAN',
      'GST registration (if any) is under your personal PAN',
    ],
    icon: <User size={20} />,
  },
  {
    key:      'business',
    title:    'Limited Company / LLP / Partnership',
    subtitle: 'Your business has a separate PAN from your personal one.',
    bullets:  [
      'Business has its own PAN (e.g. AABCS1234F)',
      'ITR & Form 26AS use the business PAN',
      'KYB checks (CIN/LLPIN, GST search) included',
    ],
    icon: <Building2 size={20} />,
  },
]

export default function BorrowerTypeStep({ value, onSelect, onNext }: Props) {
  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          What kind of borrower are you?
        </h1>
        <p className="text-graphite text-sm">
          We tailor the verification flow to your business structure.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(opt => {
          const selected = value === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => onSelect(opt.key)}
              className={`w-full text-left card p-5 transition-colors border ${
                selected
                  ? 'border-ember bg-ember/10'
                  : 'border-mist hover:border-ink'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-ember text-white' : 'bg-fog text-ember'
                }`}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{opt.title}</h3>
                    {selected && <CheckCircle2 size={16} className="text-ember" />}
                  </div>
                  <p className="text-sm text-graphite mt-1">{opt.subtitle}</p>
                  <ul className="mt-3 space-y-1">
                    {opt.bullets.map((b, i) => (
                      <li key={i} className="text-xs text-steel flex items-start gap-2">
                        <span className="text-ember mt-0.5">·</span> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        className="btn-primary"
        onClick={onNext}
        disabled={!value}
      >
        Continue <ArrowRight size={18} />
      </button>
    </div>
  )
}
