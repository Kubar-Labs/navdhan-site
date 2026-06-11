import { useState } from 'react'
import { Shield, ArrowRight, Lock } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import { verifyAadhaar } from '../api/verification'

interface Props {
  caseId: string
  result: StepResult
  onResult: (r: StepResult) => void
  onNext: () => void
  prefillMobile?: string
}

export default function AadhaarStep({ caseId, result, onResult, onNext, prefillMobile = '' }: Props) {
  const [aadhaarNo, setAadhaarNo] = useState('')
  const [mobile, setMobile]       = useState(prefillMobile)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const mobileLocked = !!prefillMobile

  const validate = () => {
    const e: Record<string, string> = {}
    if (!/^\d{12}$/.test(aadhaarNo))   e.aadhaarNo = 'Must be exactly 12 digits'
    if (!/^\d{10}$/.test(mobile))      e.mobile    = 'Must be a 10-digit mobile number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleVerify = async () => {
    if (!validate()) return
    onResult({ status: 'loading' })
    try {
      const data = await verifyAadhaar({
        aadhaar_no: aadhaarNo,
        mobile:     mobile.trim(),
        case_id:    caseId,
      })
      onResult({ status: 'success', data: { ...data, _aadhaarNo: aadhaarNo } })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Verification failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onResult({ status: 'error', error: msg })
    }
  }

  const busy = result.status === 'loading'
  const done = result.status === 'success'

  return (
    <div className="animate-slide-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Aadhaar eKYC</h2>
            <p className="text-xs text-graphite">Identity verification via UIDAI</p>
          </div>
        </div>
        <StatusBadge result={result} />
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <FormField label="Aadhaar Number" required error={errors.aadhaarNo}
          hint="12-digit unique identification number">
          <input className="input-field" placeholder="XXXX XXXX XXXX"
            maxLength={12} value={aadhaarNo}
            onChange={e => setAadhaarNo(e.target.value.replace(/\D/g, ''))}
            disabled={busy || done}
            inputMode="numeric" />
        </FormField>

        <FormField label="Registered Mobile Number" required error={errors.mobile}
          hint={mobileLocked ? 'Pre-filled from your consent step' : 'Mobile number linked to your Aadhaar'}>
          <div className="relative">
            <input className="input-field pr-10" placeholder="10-digit mobile number"
              maxLength={10} value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
              disabled={busy || done}
              readOnly={mobileLocked}
              inputMode="numeric" />
            {mobileLocked && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ember">
                <Lock size={15} />
              </div>
            )}
          </div>
        </FormField>

        {busy && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-blue-300 font-semibold text-sm">Verifying your Aadhaar…</p>
            <p className="text-xs text-graphite">
              This can take 2–3 minutes. Please keep this page open.
            </p>
            <p className="text-xs text-steel">
              ನಿಮ್ಮ ಆಧಾರ್ ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ. 2–3 ನಿಮಿಷ ಕಾಯಿರಿ, ಪುಟ ಮುಚ್ಚಬೇಡಿ.
            </p>
          </div>
        )}

        {result.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{result.error}</p>
          </div>
        )}

        {done && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">Aadhaar Verified</p>
            {!!(result.data?.is_mobile_linked) && (
              <p className="text-xs text-graphite">
                Mobile linked:{' '}
                <span className={(result.data!.is_mobile_linked as string) === 'Yes' ? 'text-green-600' : 'text-yellow-600'}>
                  {String(result.data!.is_mobile_linked)}
                </span>
              </p>
            )}
          </div>
        )}

        {!done ? (
          <button className="btn-primary" onClick={handleVerify} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify Aadhaar'} {!busy && <ArrowRight size={18} />}
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext}>
            Continue to PAN <ArrowRight size={18} />
          </button>
        )}
      </div>

      <p className="text-xs text-steel text-center">
        Your Aadhaar number is verified against UIDAI. Only the last 4 digits are retained; the full number is encrypted.
      </p>
    </div>
  )
}
