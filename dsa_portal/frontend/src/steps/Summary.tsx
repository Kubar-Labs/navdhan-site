import { CheckCircle, XCircle, Clock, RotateCcw, Download } from 'lucide-react'
import { VerificationState, StepResult } from '../types'

interface Props {
  state: VerificationState
  onRestart: () => void
}

const SECTIONS = [
  { key: 'aadhaar',     label: 'Aadhaar eKYC' },
  { key: 'pan',        label: 'PAN Authentication' },
  { key: 'panLink',    label: 'PAN–Aadhaar Link' },
  { key: 'gst',        label: 'GSTIN Verification' },
  { key: 'gstReturns', label: 'GST Return History' },
  { key: 'bank',       label: 'Bank Statement Analysis' },
  { key: 'pl',         label: 'Profit & Loss Statement' },
  { key: 'itr',        label: 'Income Tax Returns' },
  { key: 'form26as',   label: 'Form 26AS (TDS)' },
] as const

function ResultRow({ label, result }: { label: string; result: StepResult }) {
  const { status } = result
  const config = {
    success: { icon: <CheckCircle size={16} />, cls: 'text-green-600 bg-green-500/10', label: 'Verified' },
    error:   { icon: <XCircle size={16} />,    cls: 'text-red-600 bg-red-500/10',     label: 'Failed' },
    skipped: { icon: <Clock size={16} />,       cls: 'text-steel bg-fog', label: 'Skipped' },
    idle:    { icon: <Clock size={16} />,       cls: 'text-steel bg-fog', label: 'Not done' },
    loading: { icon: <Clock size={16} />,       cls: 'text-yellow-600 bg-yellow-500/10', label: 'Processing' },
  }[status]

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-mist/60 last:border-0">
      <span className="text-sm text-graphite">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${config.cls}`}>
        {config.icon} {config.label}
      </span>
    </div>
  )
}

export default function Summary({ state, onRestart }: Props) {
  const results  = SECTIONS.map(s => state[s.key])
  const verified = results.filter(r => r.status === 'success').length
  const failed   = results.filter(r => r.status === 'error').length
  const pending  = results.filter(r => r.status === 'idle' || r.status === 'skipped').length

  const pct = Math.round((verified / SECTIONS.length) * 100)
  const scoreColor = failed === 0 ? 'text-green-600' : failed > 2 ? 'text-red-600' : 'text-yellow-600'

  return (
    <div className="animate-slide-up space-y-5 pb-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold">Verification Summary</h2>
        <p className="text-sm text-graphite mt-1">Case ID: <span className="text-ink font-mono">{state.caseId}</span></p>
      </div>

      {/* Score card */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ember uppercase tracking-widest">Overall Result</p>
          <span className={`text-2xl font-bold ${scoreColor}`}>{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-fog rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              failed === 0 ? 'bg-gradient-to-r from-ember to-green-500' :
              failed > 2   ? 'bg-gradient-to-r from-red-600 to-orange-500' :
                             'bg-gradient-to-r from-ember to-yellow-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Verified', count: verified, cls: 'text-green-600' },
            { label: 'Failed',   count: failed,   cls: 'text-red-600' },
            { label: 'Pending',  count: pending,  cls: 'text-steel' },
          ].map(s => (
            <div key={s.label} className="bg-fog/70 rounded-xl py-4">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.count}</p>
              <p className="text-xs text-steel mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail rows */}
      <div className="card">
        <p className="text-xs font-semibold text-ember uppercase tracking-widest mb-3">
          Verification Details
        </p>
        {SECTIONS.map(s => (
          <ResultRow key={s.key} label={s.label} result={state[s.key]} />
        ))}
      </div>

      {/* Actions — hidden when printing */}
      <div className="space-y-3 no-print">
        <button className="btn-primary" onClick={() => window.print()}>
          <Download size={18} /> Download Report
        </button>
        <button className="btn-secondary" onClick={onRestart}>
          <RotateCcw size={16} /> Start New Verification
        </button>
      </div>

      <p className="text-xs text-steel text-center no-print">
        Powered by Perfios · Government-verified · 256-bit encrypted
      </p>
    </div>
  )
}
