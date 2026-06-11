import { useState } from 'react'
import { Building2, ArrowRight, CheckCircle2 } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import { verifyGST, getGSTReturns, type GstSearchHit } from '../api/verification'

interface Props {
  caseId: string
  gstResult: StepResult
  returnsResult: StepResult
  onGstResult: (r: StepResult) => void
  onReturnsResult: (r: StepResult) => void
  onNext: () => void
  // Pre-discovered from Business PAN step's "GST search by PAN" sub-step.
  // When non-empty, we show these as clickable options so the user doesn't
  // have to type their 15-char GSTIN manually.
  discoveredGstins?: GstSearchHit[]
}

export default function GSTStep({
  caseId, gstResult, returnsResult,
  onGstResult, onReturnsResult, onNext,
  discoveredGstins = [],
}: Props) {
  const validDiscovered = discoveredGstins.filter(g => !!g.gstin_id)
  const hasDiscovered   = validDiscovered.length > 0
  const [gstin, setGstin] = useState('')
  const [dueInfo, setDueInfo] = useState(true)
  const [liabilityDetails, setLiabilityDetails] = useState(true)
  const [latestFy, setLatestFy] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateGSTIN = () => {
    const e: Record<string, string> = {}
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.toUpperCase()))
      e.gstin = 'Invalid GSTIN (15 characters, e.g. 22AAAAA0000A1Z5)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleVerifyGST = async () => {
    if (!validateGSTIN()) return
    onGstResult({ status: 'loading' })
    try {
      const data = await verifyGST({ gstin: gstin.toUpperCase(), case_id: caseId })
      onGstResult({ status: 'success', data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'GST verification failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onGstResult({ status: 'error', error: msg })
    }
  }

  const handleFetchReturns = async () => {
    onReturnsResult({ status: 'loading' })
    try {
      const data = await getGSTReturns({
        gstin: gstin.toUpperCase(),
        case_id: caseId,
        due_info: dueInfo,
        liability_details: liabilityDetails,
        latest_fy: latestFy,
      })
      onReturnsResult({ status: 'success', data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'GST returns fetch failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onReturnsResult({ status: 'error', error: msg })
    }
  }

  const busy     = gstResult.status === 'loading' || returnsResult.status === 'loading'
  const gstDone  = gstResult.status === 'success'
  const bothDone = gstDone && returnsResult.status === 'success'

  return (
    <div className="animate-slide-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">GST Verification</h2>
            <p className="text-xs text-graphite">GSTIN auth & GSTR-1, GSTR-3B history</p>
          </div>
        </div>
        <StatusBadge result={gstResult} />
      </div>

      {/* Step 1 — GSTIN */}
      <div className="card space-y-5">
        <p className="text-xs font-semibold text-ember uppercase tracking-widest">
          Step 1 — GSTIN Authentication
        </p>

        {hasDiscovered && !gstDone && (
          <div className="space-y-2">
            <p className="text-xs text-steel">
              We found {validDiscovered.length} GSTIN{validDiscovered.length === 1 ? '' : 's'} registered
              against your entity's PAN. Pick the one for this loan application:
            </p>
            <div className="space-y-2">
              {validDiscovered.map(g => {
                const id   = g.gstin_id!
                const sel  = gstin.toUpperCase() === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGstin(id)}
                    disabled={busy}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      sel
                        ? 'border-ember bg-ember/15'
                        : 'border-mist bg-fog/40 hover:border-ember/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-ink truncate">{id}</p>
                        <p className="text-xs text-steel">
                          {g.state ?? 'Unknown state'}
                          {g.auth_status ? ` — ${g.auth_status}` : ''}
                        </p>
                      </div>
                      {sel && <CheckCircle2 size={18} className="text-ember flex-shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-steel">
              Not in this list? Type your GSTIN below.
            </p>
          </div>
        )}

        <FormField label="GSTIN" required error={errors.gstin}
          hint="15-character GST Identification Number">
          <input className="input-field uppercase tracking-widest" placeholder="22AAAAA0000A1Z5"
            maxLength={15} value={gstin}
            onChange={e => setGstin(e.target.value.toUpperCase())}
            disabled={busy || gstDone}
            autoCapitalize="characters" />
        </FormField>

        {gstResult.status === 'loading' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-blue-300 font-semibold text-sm">Verifying your GSTIN…</p>
            <p className="text-xs text-graphite">
              This can take 2–3 minutes. Please keep this page open.
            </p>
            <p className="text-xs text-steel">
              ನಿಮ್ಮ GSTIN ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ. 2–3 ನಿಮಿಷ ಕಾಯಿರಿ, ಪುಟ ಮುಚ್ಚಬೇಡಿ.
            </p>
          </div>
        )}

        {gstResult.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{gstResult.error}</p>
          </div>
        )}
        {gstDone && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">GSTIN Verified</p>
            {!!gstResult.data?.legal_name && (
              <p className="text-sm text-graphite">Entity: {String(gstResult.data.legal_name)}</p>
            )}
            {!!gstResult.data?.status && (
              <p className="text-xs text-graphite">
                GST Status: <span className="text-green-600">{String(gstResult.data.status)}</span>
              </p>
            )}
          </div>
        )}

        {!gstDone && (
          <button className="btn-primary" onClick={handleVerifyGST}
            disabled={busy || !gstin.trim()}>
            {gstResult.status === 'loading' ? 'Verifying…' : 'Verify GSTIN'}
            {gstResult.status !== 'loading' && <ArrowRight size={18} />}
          </button>
        )}
      </div>

      {/* Step 2 — Returns */}
      {gstDone && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest">
              Step 2 — Return Filing History
            </p>
            <StatusBadge result={returnsResult} />
          </div>

          <div className="space-y-2">
            {[
              { label: 'Include Due Information', value: dueInfo, set: setDueInfo },
              { label: 'Include Liability Details', value: liabilityDetails, set: setLiabilityDetails },
              { label: 'Latest Financial Year Only', value: latestFy, set: setLatestFy },
            ].map(opt => (
              <label key={opt.label}
                className="flex items-center gap-3 cursor-pointer py-3 px-4 bg-fog/60 rounded-xl active:bg-fog">
                <input type="checkbox" checked={opt.value}
                  onChange={e => opt.set(e.target.checked)}
                  disabled={busy || returnsResult.status === 'success'}
                  className="accent-ember w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-graphite">{opt.label}</span>
              </label>
            ))}
          </div>

          {returnsResult.status === 'loading' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
              <p className="text-blue-300 font-semibold text-sm">Fetching your GST return history…</p>
              <p className="text-xs text-graphite">
                This can take 2–3 minutes. Please keep this page open.
              </p>
              <p className="text-xs text-steel">
                ನಿಮ್ಮ GST ರಿಟರ್ನ್ ಇತಿಹಾಸ ತರಲಾಗುತ್ತಿದೆ. 2–3 ನಿಮಿಷ ಕಾಯಿರಿ, ಪುಟ ಮುಚ್ಚಬೇಡಿ.
              </p>
            </div>
          )}

          {returnsResult.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{returnsResult.error}</p>
            </div>
          )}
          {returnsResult.status === 'success' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <p className="text-green-600 font-semibold">GST Returns Retrieved</p>
            </div>
          )}

          {returnsResult.status !== 'success' && (
            <button className="btn-primary" onClick={handleFetchReturns} disabled={busy}>
              {returnsResult.status === 'loading' ? 'Fetching…' : 'Fetch Return History'}
              {returnsResult.status !== 'loading' && <ArrowRight size={18} />}
            </button>
          )}
        </div>
      )}

      {bothDone && (
        <button className="btn-primary" onClick={onNext}>
          Continue to Bank Statement <ArrowRight size={18} />
        </button>
      )}
    </div>
  )
}
