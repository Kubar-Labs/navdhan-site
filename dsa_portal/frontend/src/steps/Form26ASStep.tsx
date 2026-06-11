import { useRef, useState } from 'react'
import { FileCheck, ArrowRight, Lock, Upload, KeyRound, FileText } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import SkipConfirmModal from '../components/SkipConfirmModal'
import { StepResult } from '../types'
import { fetch26AS, upload26AS, skip26AS } from '../api/verification'

// Indian FY is April→March. Format: "YYYY-YY". We deliberately skip the
// freshly-ended FY because TDS data isn't complete on the IT portal until
// ~September of the next FY.
function lastThreeFinancialYears(): string[] {
  const now     = new Date()
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const years: string[] = []
  for (let i = 2; i <= 4; i++) {
    const a = fyStart - i
    const b = (a + 1).toString().slice(-2)
    years.push(`${a}-${b}`)
  }
  return years
}

const DEFAULT_YEARS  = lastThreeFinancialYears()
const DEFAULT_SOURCE = 'ITR'
const API_VERSION    = '1.0.2'

const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv'

interface Props {
  caseId: string
  result: StepResult
  onResult: (r: StepResult) => void
  onNext: () => void
  prefillPan?: string
}

type Mode = 'choose' | 'credentials' | 'upload'

export default function Form26ASStep({
  caseId, result, onResult, onNext, prefillPan = '',
}: Props) {
  const [mode, setMode] = useState<Mode>('choose')

  const [pan, setPan]           = useState(prefillPan)
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const hasPrefillPan = !!prefillPan

  const [file, setFile]     = useState<File | null>(null)
  const [uploadErr, setUploadErr] = useState('')
  const fileRef             = useRef<HTMLInputElement>(null)

  const [skipOpen, setSkipOpen] = useState(false)
  const [skipBusy, setSkipBusy] = useState(false)

  const validateCreds = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase()))
      e.pan = 'Invalid PAN (e.g. ABCDE1234F)'
    if (!password.trim()) e.password = 'IT portal password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleFetch = async () => {
    if (!validateCreds()) return
    onResult({ status: 'loading' })
    try {
      const data = await fetch26AS({
        pan:         pan.toUpperCase(),
        password:    password.trim(),
        case_id:     caseId,
        years:       DEFAULT_YEARS,
        source:      DEFAULT_SOURCE,
        api_version: API_VERSION,
      })
      onResult({ status: 'success', data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Form 26AS fetch failed'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onResult({ status: 'error', error: msg })
    }
  }

  const handleUpload = async () => {
    if (!file) { setUploadErr('Please pick a Form 26AS file'); return }
    setUploadErr('')
    onResult({ status: 'loading' })
    try {
      const data = await upload26AS({ case_id: caseId, file })
      onResult({ status: 'success', data: { source: 'upload', ...(data as Record<string, unknown>) } })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? 'Upload failed'
      onResult({ status: 'error', error: msg })
    }
  }

  const handleSkip = async () => {
    setSkipBusy(true)
    try {
      const data = await skip26AS({ case_id: caseId })
      onResult({ status: 'success', data: { source: 'skipped', ...(data as Record<string, unknown>) } })
      setSkipOpen(false)
      onNext()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Could not record skip'
      onResult({ status: 'error', error: msg })
    } finally {
      setSkipBusy(false)
    }
  }

  const busy = result.status === 'loading'
  const done = result.status === 'success'

  return (
    <div className="animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember/20 flex items-center justify-center text-ember flex-shrink-0">
            <FileCheck size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Form 26AS</h2>
            <p className="text-xs text-graphite">Upload a sheet or fetch from the IT portal (last 3 FYs)</p>
          </div>
        </div>
        <StatusBadge result={result} />
      </div>

      {/* ── Choice screen ────────────────────────────────────────────── */}
      {mode === 'choose' && !done && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-ember uppercase tracking-widest">How would you like to share your Form 26AS?</p>

          <button
            onClick={() => setMode('upload')}
            className="w-full text-left rounded-xl border border-mist bg-fog/40 hover:border-ember/40 transition-colors px-4 py-3 flex items-start gap-3"
          >
            <Upload size={18} className="text-ember mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">Upload Form 26AS sheet</p>
              <p className="text-xs text-steel">PDF, Excel, CSV or Word. Recommended if you've already downloaded it.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('credentials')}
            className="w-full text-left rounded-xl border border-mist bg-fog/40 hover:border-ember/40 transition-colors px-4 py-3 flex items-start gap-3"
          >
            <KeyRound size={18} className="text-ember mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">Enter IT portal credentials</p>
              <p className="text-xs text-steel">We'll fetch Form 26AS for FY {DEFAULT_YEARS.join(', ')} from incometax.gov.in.</p>
            </div>
          </button>

          <button
            onClick={() => setSkipOpen(true)}
            className="w-full text-center text-xs text-steel hover:text-amber-300 transition-colors pt-2"
          >
            I don't have either right now — skip this step
          </button>
        </div>
      )}

      {/* ── Upload screen ────────────────────────────────────────────── */}
      {mode === 'upload' && !done && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} /> Upload Form 26AS sheet
            </p>
            <button onClick={() => setMode('choose')} className="text-xs text-steel hover:text-graphite underline">
              Change method
            </button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${
              file ? 'border-ember/50 bg-ember/5' : 'border-mist hover:border-ember/30'
            }`}
            onClick={() => !busy && fileRef.current?.click()}
          >
            <Upload size={28} className="mx-auto text-steel mb-3" />
            {file ? (
              <p className="text-sm text-ember font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-graphite font-medium">Tap to upload your Form 26AS</p>
                <p className="text-xs text-steel mt-1">PDF, DOC, DOCX, XLS, XLSX or CSV</p>
              </>
            )}
            <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadErr('') }}
              disabled={busy} />
          </div>

          {uploadErr && <p className="text-sm text-red-600">{uploadErr}</p>}
          {result.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{result.error}</p>
            </div>
          )}

          <button className="btn-primary" onClick={handleUpload} disabled={busy || !file}>
            {busy ? 'Uploading…' : 'Upload & Continue'} {!busy && <ArrowRight size={18} />}
          </button>
        </div>
      )}

      {/* ── Credentials screen ───────────────────────────────────────── */}
      {mode === 'credentials' && !done && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ember uppercase tracking-widest flex items-center gap-2">
              <KeyRound size={14} /> IT portal credentials
            </p>
            <button onClick={() => setMode('choose')} className="text-xs text-steel hover:text-graphite underline">
              Change method
            </button>
          </div>

          <FormField label="PAN Number" required error={errors.pan}
            hint={hasPrefillPan ? 'Auto-filled from PAN step' : '10-character Permanent Account Number'}>
            <div className="relative">
              <input className="input-field uppercase tracking-widest pr-10" placeholder="ABCDE1234F"
                maxLength={10} value={pan}
                onChange={hasPrefillPan ? undefined : e => setPan(e.target.value.toUpperCase())}
                readOnly={hasPrefillPan} disabled={busy} autoCapitalize="characters" />
              {hasPrefillPan && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ember">
                  <Lock size={15} />
                </div>
              )}
            </div>
          </FormField>

          <FormField label="IT Portal Password" required error={errors.password}
            hint="Login password for incometax.gov.in (the e-filing portal)">
            <input className="input-field" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
          </FormField>

          <div className="bg-fog/60 border border-mist rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs text-steel uppercase tracking-wider font-semibold">We'll fetch</p>
            <p className="text-sm text-graphite">
              Form 26AS for FY <span className="text-ember font-medium">{DEFAULT_YEARS.join(', ')}</span>
            </p>
          </div>

          {busy && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
              <p className="text-blue-300 font-semibold text-sm">Fetching your Form 26AS…</p>
              <p className="text-xs text-graphite">This can take 2–3 minutes. Please keep this page open.</p>
            </div>
          )}

          {result.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{result.error}</p>
            </div>
          )}

          <button className="btn-primary" onClick={handleFetch} disabled={busy}>
            {busy ? 'Fetching…' : 'Fetch 26AS'} {!busy && <ArrowRight size={18} />}
          </button>

          <p className="text-xs text-steel text-center">
            Your IT portal password is transmitted securely and never stored in plain text.
          </p>
        </div>
      )}

      {/* ── Done state ───────────────────────────────────────────────── */}
      {done && (
        <div className="card space-y-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">
              {(result.data?.source === 'skipped') ? 'Form 26AS step skipped'
                : (result.data?.source === 'upload') ? 'Form 26AS Uploaded'
                : 'Form 26AS Retrieved'}
            </p>
            <p className="text-xs text-graphite">
              Stored securely. Lender will review before finalising the loan.
            </p>
          </div>
          <button className="btn-primary" onClick={onNext}>
            View Summary <ArrowRight size={18} />
          </button>
        </div>
      )}

      <SkipConfirmModal
        open={skipOpen}
        docLabel="Form 26AS"
        busy={skipBusy}
        onCancel={() => setSkipOpen(false)}
        onConfirm={handleSkip}
      />
    </div>
  )
}
