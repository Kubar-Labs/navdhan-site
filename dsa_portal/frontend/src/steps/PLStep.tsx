import { useRef, useState } from 'react'
import { ArrowRight, BarChart2, Upload } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { StepResult } from '../types'
import { plUpload } from '../api/verification'

interface Props {
  caseId: string
  result: StepResult
  onResult: (r: StepResult) => void
  onNext: () => void
}

export default function PLStep({ caseId, result, onResult, onNext }: Props) {
  const [file, setFile]   = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef           = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!file) { setError('Please upload a P&L document'); return }
    setError('')
    onResult({ status: 'loading' })
    try {
      const data = await plUpload({ case_id: caseId, file })
      onResult({ status: 'success', data })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? 'Upload failed'
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
            <BarChart2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Profit &amp; Loss</h2>
            <p className="text-xs text-graphite">Upload P&amp;L statement — stored securely</p>
          </div>
        </div>
        <StatusBadge result={result} />
      </div>

      <div className="card space-y-5">
        <div
          className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${
            file
              ? 'border-ember/50 bg-ember/5'
              : 'border-mist hover:border-ember/30 active:border-ember/50'
          }`}
          onClick={() => !busy && !done && fileRef.current?.click()}
        >
          <Upload size={28} className="mx-auto text-steel mb-3" />
          {file ? (
            <p className="text-sm text-ember font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-graphite font-medium">Tap to upload P&amp;L document</p>
              <p className="text-xs text-steel mt-1">PDF, DOC or DOCX accepted</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }}
            disabled={busy || done}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {result.status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{result.error}</p>
          </div>
        )}

        {done && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-1">
            <p className="text-green-600 font-semibold">P&amp;L Document Uploaded</p>
            <p className="text-xs text-graphite">Stored securely. Lender will review before finalising the loan.</p>
          </div>
        )}

        {!done ? (
          <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Uploading…' : 'Upload Document'} {!busy && <ArrowRight size={18} />}
          </button>
        ) : (
          <button className="btn-primary" onClick={onNext}>
            Continue <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
