import { useRef, useState } from 'react'
import { FileCheck, ArrowRight, Lock, Upload, KeyRound, FileText } from 'lucide-react'
import FormField from '../components/FormField'
import StatusBadge from '../components/StatusBadge'
import SkipConfirmModal from '../components/SkipConfirmModal'
import { StepResult } from '../types'
import { saveITR, uploadITR, skipITR } from '../api/verification'

interface Props {
  caseId: string
  result: StepResult
  onResult: (r: StepResult) => void
  onNext: () => void
  prefillPan?: string
}

type Mode = 'choose' | 'credentials' | 'upload'

const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv'

export default function ITRStep({ caseId, result, onResult, onNext, prefillPan = '' }: Props) {
  const [mode, setMode] = useState<Mode>('choose')

  // ── credentials path ──────────────────────────────────────────────────
  const [pan, setPan]           = useState(prefillPan)
  const hasPrefillPan = !!prefillPan
  const [password, setPassword] = useState('')
  const [years, setYears]       = useState(3)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  // ── upload path ───────────────────────────────────────────────────────
  const [file, setFile]     = useState<File | null>(null)
  const [uploadErr, setUploadErr] = useState('')
  const fileRef             = useRef<HTMLInputElement>(null)

  // ── skip popup ────────────────────────────────────────────────────────
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipBusy, setSkipBusy] = useState(false)

  const validateCreds = () => {
    const e: Record<string, string> = {}
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase()))
      e.pan = 'Invalid PAN (e.g. ABCDE1234F)'
    if (!password.trim())
      e.password = 'IT portal password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveCredentials = async () => {
    if (!validateCreds()) return
    onResult({ status: 'loading' })
    try {
      const data = await saveITR({
        pan:             pan.toUpperCase(),
        password:        password.trim(),
        case_id:         caseId,
        number_of_years: years,
      })
      onResult({ status: 'success', data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const raw = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? 'Could not save ITR credentials'
      const msg = (status && status >= 500) || raw.includes('<')
        ? 'Verification service is temporarily unavailable. Please try again in a moment.'
        : raw
      onResult({ status: 'error', error: msg })
    }
  }

  const handleUpload = async () => {
    if (!file) { setUploadErr('Please pick an ITR file'); return }
    setUploadErr('')
    onResult({ status: 'loading' })
    try {
      const data = await uploadITR({ case_id: caseId, file })
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
      const data = await skipITR({ case_id: caseId })
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
            <h2 className="text-xl font-bold">Income Tax Returns</h2>
            <p className="text-xs text-graphite">Upload a sheet or fetch directly from the IT portal</p>
          </div>
        </div>
        <StatusBadge result={result} />
      </div>

      {/* ── Choice screen (default) ──────────────────────────────────── */}
      {mode === 'choose' && !done && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-ember uppercase tracking-widest">How would you like to share your ITR?</p>

          <button
            onClick={() => setMode('upload')}
            className="w-full text-left rounded-xl border border-mist bg-fog/40 hover:border-ember/40 transition-colors px-4 py-3 flex items-start gap-3"
          >
            <Upload size={18} className="text-ember mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">Upload ITR sheet</p>
              <p className="text-xs text-steel">PDF, Excel, CSV or Word. Recommended if you have a recent ITR copy.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('credentials')}
            className="w-full text-left rounded-xl border border-mist bg-fog/40 hover:border-ember/40 transition-colors px-4 py-3 flex items-start gap-3"
          >
            <KeyRound size={18} className="text-ember mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">Enter IT portal credentials</p>
              <p className="text-xs text-steel">We'll fetch the latest ITR directly from incometax.gov.in. Password is encrypted.</p>
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
              <FileText size={14} /> Upload ITR sheet
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
                <p className="text-sm text-graphite font-medium">Tap to upload your ITR document</p>
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
            hint="Login password for the Income Tax e-filing portal">
            <input className="input-field" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
          </FormField>

          <FormField label="Number of Years">
            <select className="input-field" value={years}
              onChange={e => setYears(Number(e.target.value))} disabled={busy}>
              <option value={1}>1 Year</option>
              <option value={2}>2 Years</option>
              <option value={3}>3 Years</option>
            </select>
          </FormField>

          {busy && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
              <p className="text-blue-300 font-semibold text-sm">Saving your ITR credentials…</p>
              <p className="text-xs text-graphite">This can take 2–3 minutes. Please keep this page open.</p>
            </div>
          )}

          {result.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{result.error}</p>
            </div>
          )}

          <button className="btn-primary" onClick={handleSaveCredentials} disabled={busy}>
            {busy ? 'Saving…' : 'Save & Continue'} {!busy && <ArrowRight size={18} />}
          </button>

          <p className="text-xs text-steel leading-relaxed">
            Your credentials are encrypted (AES-256) and only accessible to the lender.
          </p>
        </div>
      )}

      {/* ── Done state ───────────────────────────────────────────────── */}
      {done && (
        <div className="card space-y-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">
              {(result.data?.source === 'skipped') ? 'ITR step skipped'
                : (result.data?.source === 'upload') ? 'ITR Document Uploaded'
                : 'ITR Credentials Saved'}
            </p>
            <p className="text-xs text-graphite">
              Stored securely. Lender will review before finalising the loan.
            </p>
          </div>
          <button className="btn-primary" onClick={onNext}>
            Continue to Form 26AS <ArrowRight size={18} />
          </button>
        </div>
      )}

      <SkipConfirmModal
        open={skipOpen}
        docLabel="ITR"
        busy={skipBusy}
        onCancel={() => setSkipOpen(false)}
        onConfirm={handleSkip}
      />
    </div>
  )
}
