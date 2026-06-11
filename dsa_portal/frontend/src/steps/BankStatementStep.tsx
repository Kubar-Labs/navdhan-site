import { useState, useRef } from 'react'
import { Landmark, ArrowRight, Upload, Phone, RefreshCw } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import { bsaUpload } from '../api/verification'

const DEFAULT_LOAN_TYPE = 'Business Loan'

interface Props {
  caseId: string
  result: StepResult
  onResult: (r: StepResult) => void
  onNext: () => void
}

export default function BankStatementStep({ caseId, result, onResult, onNext }: Props) {
  const [loanAmount, setLoanAmount] = useState('')
  const [password, setPassword]     = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!loanAmount || isNaN(Number(loanAmount)) || Number(loanAmount) <= 0)
      e.loanAmount = 'Enter a valid loan amount'
    if (!file) e.file = 'Upload a bank statement PDF'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    onResult({ status: 'loading' })
    try {
      const data = await bsaUpload({
        case_id:     caseId,
        file:        file!,
        password:    password || undefined,
        loan_amount: Number(loanAmount),
        loan_type:   DEFAULT_LOAN_TYPE,
      })
      onResult({ status: 'success', data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const detail = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? 'Upload failed'
      let msg: string
      if (status === 422) {
        // Perfios rejected the statement — show the specific reason
        msg = detail
      } else if (!status || status >= 500 || detail.includes('<')) {
        // Service/infra error — generic message
        msg = 'Verification failed. Please try after some time.'
      } else {
        msg = detail
      }
      onResult({ status: 'error', error: msg })
    }
  }

  const busy = result.status === 'loading'
  const done = result.status === 'success'

  return (
    <div className="animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Bank Statement</h2>
            <p className="text-xs text-graphite">Upload PDF — analysed by lender</p>
          </div>
        </div>
        <StatusBadge result={result} />
      </div>

      <div className="card space-y-5">
        <FormField label="Loan Amount (₹)" required error={errors.loanAmount}>
          <input className="input-field" placeholder="500000"
            value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
            disabled={busy || done} inputMode="numeric" />
        </FormField>

        <FormField label="PDF Password"
          hint="Enter only if your bank statement PDF is locked / ನಿಮ್ಮ PDF ಪಾಸ್‌ವರ್ಡ್ ಲಾಕ್ ಆಗಿದ್ದರೆ ಮಾತ್ರ ನಮೂದಿಸಿ. Stored encrypted.">
          <input className="input-field" type="password" placeholder="Leave blank if not password-protected"
            value={password} onChange={e => setPassword(e.target.value)}
            disabled={busy || done} />
        </FormField>

        <FormField label="Bank Statement PDF" required error={errors.file}>
          <div
            className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${
              file
                ? 'border-ember/50 bg-ember/5'
                : 'border-mist hover:border-ember/30 active:border-ember/50'
            }`}
            onClick={() => !busy && !done && result.status !== 'error' && fileRef.current?.click()}
          >
            <Upload size={28} className="mx-auto text-steel mb-3" />
            {file ? (
              <p className="text-sm text-ember font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-graphite font-medium">Tap to upload PDF</p>
                <p className="text-xs text-steel mt-1">Last 6–12 months of statements</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              disabled={busy || done} />
          </div>
        </FormField>

        {busy && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-blue-300 font-semibold text-sm">Analysing your bank statement…</p>
            <p className="text-xs text-graphite">
              This usually takes 2–3 minutes. Please keep this page open.
            </p>
            <p className="text-xs text-steel">
              ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ವಿಶ್ಲೇಷಣೆ ನಡೆಯುತ್ತಿದೆ. 2–3 ನಿಮಿಷ ಕಾಯಿರಿ, ಪುಟ ಮುಚ್ಚಬೇಡಿ.
            </p>
          </div>
        )}

        {result.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 space-y-3">
            <p className="text-sm text-red-600 font-semibold">{result.error}</p>
            <div className="border-t border-red-500/20 pt-3 space-y-2">
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-fog hover:bg-mist text-sm text-ink transition-colors"
                onClick={() => {
                  setFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                  onResult({ status: 'idle' } as StepResult)
                }}
              >
                <RefreshCw size={15} /> Try uploading a different file
              </button>
              <a
                href="tel:+917872260684"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-fog hover:bg-mist text-sm text-ink transition-colors"
              >
                <Phone size={15} /> Need help? Call +91 78722 60684
              </a>
            </div>
          </div>
        )}
        {done && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">Bank Statement Uploaded</p>
            <p className="text-xs text-graphite">
              Stored securely. Analysis will run before the loan is finalized.
            </p>
          </div>
        )}

        {!done && result.status !== 'error' && (
          <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Analysing…' : 'Upload Statement'} {!busy && <ArrowRight size={18} />}
          </button>
        )}
        {done && (
          <button className="btn-primary" onClick={onNext}>
            Continue to ITR <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
