import { useState } from 'react'
import { CreditCard, ArrowRight, Lock } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import { verifyPAN, checkPANLink } from '../api/verification'
import { CONSENT_TEXT } from './ConsentStep'

interface Props {
  caseId: string
  panResult: StepResult
  linkResult: StepResult
  onPanResult: (r: StepResult) => void
  onLinkResult: (r: StepResult) => void
  onNext: () => void
  prefillAadhaar?: string
}

export default function PANStep({
  caseId, panResult, linkResult,
  onPanResult, onLinkResult, onNext,
  prefillAadhaar = '',
}: Props) {
  const [pan, setPan] = useState('')
  const [aadhaarNo] = useState(prefillAadhaar)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const panVerifiedName = panResult.status === 'success'
    ? String(panResult.data?.name ?? '')
    : ''
  const effectiveName = panVerifiedName || name

  const validatePAN = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase())) e.pan = 'Invalid PAN (e.g. ABCDE1234F)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateLink = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase())) e.pan = 'Invalid PAN'
    if (!/^\d{12}$/.test(aadhaarNo)) e.aadhaarNo = 'Aadhaar must be 12 digits'
    if (!effectiveName.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleVerifyPAN = async () => {
    if (!validatePAN()) return
    onPanResult({ status: 'loading' })
    try {
      const data = await verifyPAN({
        pan: pan.toUpperCase(),
        case_id: caseId,
        name: name.trim() || undefined,
      })
      onPanResult({ status: 'success', data: { ...data, _pan: pan.toUpperCase() } })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'PAN verification failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onPanResult({ status: 'error', error: msg })
    }
  }

  const handleCheckLink = async () => {
    if (!validateLink()) return
    onLinkResult({ status: 'loading' })
    try {
      const data = await checkPANLink({
        pan: pan.toUpperCase(),
        aadhaar_no: aadhaarNo,
        name: effectiveName.trim(),
        case_id: caseId,
        consent_text: CONSENT_TEXT,
      })
      if (!data.linked) {
        onLinkResult({
          status: 'error',
          error: 'PAN and Aadhaar are not linked. Both documents must belong to the same individual.',
        })
        return
      }
      onLinkResult({ status: 'success', data })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Link check failed'
      onLinkResult({ status: 'error', error: msg })
    }
  }

  const busy     = panResult.status === 'loading' || linkResult.status === 'loading'
  const panDone  = panResult.status === 'success'
  const bothDone = panDone && linkResult.status === 'success'
  const hasPrefilledAadhaar = !!prefillAadhaar

  return (
    <div className="animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Personal PAN Verification</h2>
            <p className="text-xs text-graphite">Signatory's PAN auth &amp; Aadhaar linkage check</p>
          </div>
        </div>
        <StatusBadge result={panResult} />
      </div>

      <div className="card space-y-5">
        <p className="text-xs font-semibold text-ember uppercase tracking-widest">
          Step 1 — Personal PAN Authentication
        </p>

        <FormField label="Personal PAN Number" required error={errors.pan}
          hint="10-character Permanent Account Number (your personal PAN, not the business)">
          <input className="input-field uppercase tracking-widest" placeholder="ABCDE1234F"
            maxLength={10} value={pan}
            onChange={e => setPan(e.target.value.toUpperCase())}
            disabled={busy || panDone}
            autoCapitalize="characters" />
        </FormField>

        {panResult.status === 'loading' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-blue-300 font-semibold text-sm">Verifying your PAN…</p>
            <p className="text-xs text-graphite">This can take 2–3 minutes. Please keep this page open.</p>
            <p className="text-xs text-steel">ನಿಮ್ಮ PAN ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ. 2–3 ನಿಮಿಷ ಕಾಯಿರಿ, ಪುಟ ಮುಚ್ಚಬೇಡಿ.</p>
          </div>
        )}

        {panResult.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{panResult.error}</p>
          </div>
        )}
        {panDone && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-green-600 font-semibold">PAN Verified</p>
              {!!panResult.data?.name && (
                <p className="text-sm text-graphite mt-1">Name on PAN: {String(panResult.data.name)}</p>
              )}
            </div>
            <button className="text-xs text-steel hover:text-graphite underline flex-shrink-0 mt-0.5"
              onClick={() => { onPanResult({ status: 'idle' }); onLinkResult({ status: 'idle' }) }}>
              Edit
            </button>
          </div>
        )}

        {!panDone && (
          <button className="btn-primary" onClick={handleVerifyPAN}
            disabled={busy || !pan.trim()}>
            {panResult.status === 'loading' ? 'Verifying…' : 'Verify PAN'}
            {panResult.status !== 'loading' && <ArrowRight size={18} />}
          </button>
        )}
      </div>

      {panDone && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest">
              Step 2 — PAN–Aadhaar Link Status
            </p>
            <StatusBadge result={linkResult} />
          </div>

          <FormField label="Aadhaar Number" required error={errors.aadhaarNo}
            hint={hasPrefilledAadhaar ? 'Auto-filled from Aadhaar step' : '12-digit Aadhaar number'}>
            <div className="relative">
              <input className="input-field pr-10" placeholder="XXXX XXXX XXXX"
                maxLength={12} value={aadhaarNo} readOnly disabled />
              {hasPrefilledAadhaar && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ember">
                  <Lock size={15} />
                </div>
              )}
            </div>
            {hasPrefilledAadhaar && (
              <p className="text-xs text-ember/70 mt-1 flex items-center gap-1">
                <Lock size={11} /> Pre-filled from your Aadhaar step
              </p>
            )}
          </FormField>

          <FormField label="Full Name" required error={errors.name}
            hint={panVerifiedName ? 'Auto-filled from PAN verification' : undefined}>
            <div className="relative">
              <input className="input-field pr-10" placeholder="Name as on PAN / Aadhaar"
                value={effectiveName} onChange={e => setName(e.target.value)}
                readOnly={!!panVerifiedName}
                disabled={busy || linkResult.status === 'success'} />
              {!!panVerifiedName && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ember">
                  <Lock size={15} />
                </div>
              )}
            </div>
            {!!panVerifiedName && (
              <p className="text-xs text-ember/70 mt-1 flex items-center gap-1">
                <Lock size={11} /> Pre-filled from your PAN verification
              </p>
            )}
          </FormField>

          {linkResult.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{linkResult.error}</p>
            </div>
          )}
          {linkResult.status === 'success' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <p className="text-green-600 font-semibold">PAN–Aadhaar Link Checked</p>
            </div>
          )}

          {linkResult.status !== 'success' && (
            <button className="btn-primary" onClick={handleCheckLink} disabled={busy}>
              {linkResult.status === 'loading' ? 'Checking…' : 'Check Link Status'}
              {linkResult.status !== 'loading' && <ArrowRight size={18} />}
            </button>
          )}
        </div>
      )}

      {bothDone && (
        <button className="btn-primary" onClick={onNext}>
          Continue <ArrowRight size={18} />
        </button>
      )}
    </div>
  )
}
