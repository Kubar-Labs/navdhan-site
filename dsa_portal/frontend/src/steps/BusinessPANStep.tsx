import { useState } from 'react'
import { Building2, ArrowRight, FileSearch, CreditCard } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import {
  verifyPanKyb,
  fetchCinLlpin,
  fetchGstByPan,
  type CinLlpinResult,
  type GstSearchHit,
} from '../api/verification'

interface Props {
  caseId: string
  result: StepResult                         // overall completion of the business-PAN step
  onResult: (r: StepResult) => void
  onNext: () => void
}

export default function BusinessPANStep({
  caseId, result, onResult, onNext,
}: Props) {
  const [pan, setPan] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [panResult,      setPanResult]      = useState<StepResult>({ status: 'idle' })
  const [cinResult,      setCinResult]      = useState<StepResult>({ status: 'idle' })
  const [gstByPanResult, setGstByPanResult] = useState<StepResult>({ status: 'idle' })

  const validatePAN = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase())) e.pan = 'Invalid PAN (e.g. AABCS1234F)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleVerifyPAN = async () => {
    if (!validatePAN()) return
    setPanResult({ status: 'loading' })
    try {
      const data = await verifyPanKyb({ pan: pan.toUpperCase(), case_id: caseId })
      setPanResult({ status: 'success', data: { ...(data as unknown as Record<string, unknown>), _pan: pan.toUpperCase() } })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Business PAN verification failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      setPanResult({ status: 'error', error: msg })
    }
  }

  const handleFetchCin = async () => {
    setCinResult({ status: 'loading' })
    try {
      const data = await fetchCinLlpin({ pan: pan.toUpperCase(), case_id: caseId })
      setCinResult({ status: 'success', data: data as unknown as Record<string, unknown> })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'CIN/LLPIN lookup failed'
      setCinResult({ status: 'error', error: msg })
    }
  }

  const handleFetchGst = async () => {
    setGstByPanResult({ status: 'loading' })
    try {
      const data = await fetchGstByPan({ pan: pan.toUpperCase(), case_id: caseId })
      setGstByPanResult({ status: 'success', data: data as unknown as Record<string, unknown> })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'GST search failed'
      setGstByPanResult({ status: 'error', error: msg })
    }
  }

  const panDone      = panResult.status      === 'success'
  const cinDone      = cinResult.status      === 'success'
  const gstByPanDone = gstByPanResult.status === 'success'
  const allDone      = panDone && cinDone && gstByPanDone
  const busy = panResult.status === 'loading'
    || cinResult.status === 'loading'
    || gstByPanResult.status === 'loading'

  const handleContinue = () => {
    // Pass the discovered GSTINs forward so GSTStep can render them as a
    // clickable choice list instead of asking the user to type one manually.
    const discoveredGstins =
      (gstByPanResult.data?.results as GstSearchHit[] | undefined) ?? []
    onResult({
      status: 'success',
      data: {
        _pan: pan.toUpperCase(),
        discoveredGstins,
      },
    })
    onNext()
  }

  return (
    <div className="animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Business PAN</h2>
            <p className="text-xs text-graphite">Entity PAN, CIN/LLPIN and GSTIN lookup</p>
          </div>
        </div>
        <StatusBadge result={result.status === 'success' ? result : panResult} />
      </div>

      {/* Step 1 — Entity PAN auth */}
      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ember uppercase tracking-widest flex items-center gap-2">
            <CreditCard size={14} /> Step 1 — Entity PAN Authentication
          </p>
          <StatusBadge result={panResult} />
        </div>

        <FormField label="Entity PAN Number" required error={errors.pan}
          hint="10-character PAN of the business entity (4th char usually C / F / H / A / T / B / L / J / G).">
          <input className="input-field uppercase tracking-widest" placeholder="AABCS1234F"
            maxLength={10} value={pan}
            onChange={e => setPan(e.target.value.toUpperCase())}
            disabled={busy || panDone}
            autoCapitalize="characters" />
        </FormField>

        {panResult.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{panResult.error}</p>
          </div>
        )}
        {panDone && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-green-600 font-semibold">Entity PAN Verified</p>
              {!!panResult.data?.name && (
                <p className="text-sm text-graphite mt-1">Entity name: {String(panResult.data.name)}</p>
              )}
            </div>
            <button className="text-xs text-steel hover:text-graphite underline flex-shrink-0 mt-0.5"
              onClick={() => {
                setPanResult({ status: 'idle' })
                setCinResult({ status: 'idle' })
                setGstByPanResult({ status: 'idle' })
              }}>
              Edit
            </button>
          </div>
        )}

        {!panDone && (
          <button className="btn-primary" onClick={handleVerifyPAN}
            disabled={busy || !pan.trim()}>
            {panResult.status === 'loading' ? 'Verifying…' : 'Verify Entity PAN'}
            {panResult.status !== 'loading' && <ArrowRight size={18} />}
          </button>
        )}
      </div>

      {/* Step 2 — CIN/LLPIN */}
      {panDone && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest flex items-center gap-2">
              <Building2 size={14} /> Step 2 — CIN / LLPIN
            </p>
            <StatusBadge result={cinResult} />
          </div>

          <p className="text-xs text-steel">
            Confirms the PAN belongs to a registered company (CIN) or LLP (LLPIN).
          </p>

          {cinResult.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{cinResult.error}</p>
            </div>
          )}

          {cinDone && (() => {
            const results = (cinResult.data?.results as CinLlpinResult[] | undefined) ?? []
            const first = results[0]
            return (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
                <p className="text-green-600 font-semibold">CIN / LLPIN Found</p>
                {first?.entity_id && (
                  <p className="text-sm text-graphite">ID: <span className="font-mono">{first.entity_id}</span></p>
                )}
                {first?.name && (
                  <p className="text-sm text-graphite">Entity: {first.name}</p>
                )}
                {results.length > 1 && (
                  <p className="text-xs text-steel">+ {results.length - 1} more associated entity(ies)</p>
                )}
              </div>
            )
          })()}

          {!cinDone && (
            <button className="btn-primary" onClick={handleFetchCin} disabled={busy}>
              {cinResult.status === 'loading' ? 'Looking up…' : 'Fetch CIN / LLPIN'}
              {cinResult.status !== 'loading' && <ArrowRight size={18} />}
            </button>
          )}
        </div>
      )}

      {/* Step 3 — GST search by PAN */}
      {panDone && cinDone && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest flex items-center gap-2">
              <FileSearch size={14} /> Step 3 — GSTINs registered against PAN
            </p>
            <StatusBadge result={gstByPanResult} />
          </div>

          <p className="text-xs text-steel">
            We look up every GSTIN registered against this PAN across India.
            An entity may have zero, one, or many GSTINs — all outcomes are
            valid and will move you forward.
          </p>

          {gstByPanResult.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{gstByPanResult.error}</p>
            </div>
          )}

          {gstByPanDone && (() => {
            const count = (gstByPanResult.data?.count as number | undefined) ?? 0
            const hits  = (gstByPanResult.data?.results as GstSearchHit[] | undefined) ?? []
            return (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-2">
                <p className="text-green-600 font-semibold">
                  {count === 0
                    ? 'No GSTIN registered against this PAN'
                    : `Found ${count} GSTIN${count === 1 ? '' : 's'}`}
                </p>
                {hits.slice(0, 5).map(h => (
                  <p key={h.gstin_id} className="text-sm text-graphite">
                    <span className="font-mono">{h.gstin_id}</span>
                    {h.state ? ` — ${h.state}` : ''}
                    {h.auth_status ? ` (${h.auth_status})` : ''}
                  </p>
                ))}
                {hits.length > 5 && (
                  <p className="text-xs text-steel">+ {hits.length - 5} more</p>
                )}
              </div>
            )
          })()}

          {!gstByPanDone && (
            <button className="btn-primary" onClick={handleFetchGst} disabled={busy}>
              {gstByPanResult.status === 'loading' ? 'Searching…' : 'Search GSTINs by PAN'}
              {gstByPanResult.status !== 'loading' && <ArrowRight size={18} />}
            </button>
          )}
        </div>
      )}

      {allDone && (
        <button className="btn-primary" onClick={handleContinue}>
          Continue to GST <ArrowRight size={18} />
        </button>
      )}
    </div>
  )
}
