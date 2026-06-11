import { Shield, ArrowRight, FileCheck, CreditCard, Building2, Landmark } from 'lucide-react'

interface Props {
  caseId: string                       // unused now; case_id is created after consent
  onChange: (caseId: string) => void   // kept to preserve App.tsx contract
  onStart: () => void
}

// caseId/onChange are part of the contract but no longer used here.

const checks = [
  { icon: <Shield size={16} />,    label: 'Aadhaar eKYC Verification' },
  { icon: <CreditCard size={16} />, label: 'PAN & Aadhaar Link Status' },
  { icon: <Building2 size={16} />, label: 'GSTIN + GST Return History' },
  { icon: <Landmark size={16} />,  label: 'Bank Statement Analysis' },
  { icon: <FileCheck size={16} />, label: 'Income Tax Returns (3 Years)' },
  { icon: <FileCheck size={16} />, label: 'Form 26AS — TDS Certificate' },
]

export default function Welcome({ onStart }: Props) {
  return (
    <div className="animate-slide-up space-y-6 pt-2">

      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          KYC Verification
          <span className="block text-ember">Portal</span>
        </h1>
        <p className="text-graphite text-base leading-relaxed">
          Complete your Know Your Customer verification in minutes.
          All data is verified directly against government sources in real-time.
        </p>
      </div>

      {/* Checklist */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-ember uppercase tracking-widest">
          What we verify
        </p>
        <div className="grid grid-cols-1 gap-2">
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-3 px-4 bg-fog/60 rounded-xl">
              <span className="text-ember flex-shrink-0">{c.icon}</span>
              <span className="text-sm text-graphite">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-sm text-graphite leading-relaxed">
          You'll be asked for your consent before we begin. A unique case ID
          will be created for your application after you accept.
        </p>

        <button className="btn-primary" onClick={onStart}>
          Get Started <ArrowRight size={18} />
        </button>
      </div>

      <p className="text-xs text-steel text-center pb-4">
        Government-verified · 256-bit encrypted · DPDP Act 2023 compliant
      </p>
    </div>
  )
}
